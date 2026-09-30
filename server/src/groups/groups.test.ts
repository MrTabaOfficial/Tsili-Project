import { pino } from "pino";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { groupWithMembersSchema, inviteCodeSchema, invitePreviewSchema, memberSchema } from "@tsili/shared";
import { bearer, registerUser, type TestUser } from "../../test/auth-helpers.js";
import { resetDb } from "../../test/reset-db.js";
import { createApp } from "../app.js";
import { createDb, type Db } from "../db.js";
import { loadEnv } from "../env.js";

let db: Db;
let app: ReturnType<typeof createApp>;
let luka: TestUser;
let nino: TestUser;

beforeAll(() => {
  const env = loadEnv();
  db = createDb(env.DATABASE_URL);
  app = createApp({ env, db, logger: pino({ level: "silent" }) });
});

beforeEach(async () => {
  await resetDb(db);
  luka = await registerUser(app, "Luka");
  nino = await registerUser(app, "Nino");
});

afterAll(async () => {
  await db.$disconnect();
});

async function createGroup(user: TestUser, name = "Kazbegi trip") {
  const res = await request(app).post("/groups").set(bearer(user)).send({ name });
  expect(res.status).toBe(201);
  return groupWithMembersSchema.parse(res.body);
}

describe("POST /groups", () => {
  it("creates a group with the creator as its first member", async () => {
    const { group, members } = await createGroup(luka);
    expect(group.name).toBe("Kazbegi trip");
    expect(group.currency).toBe("GEL");
    expect(inviteCodeSchema.safeParse(group.inviteCode).success).toBe(true);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ name: "Luka", userId: luka.id, groupId: group.id });
  });

  it("keeps a client-supplied id and rejects a duplicate", async () => {
    const id = "7a1c2a3e-0000-4000-8000-000000000001";
    const res = await request(app).post("/groups").set(bearer(luka)).send({ id, name: "Flat" });
    expect(res.status).toBe(201);
    expect(res.body.group.id).toBe(id);
    const dup = await request(app).post("/groups").set(bearer(nino)).send({ id, name: "Other" });
    expect(dup.status).toBe(409);
  });

  it("uses the client's own member id and name for the creator when given", async () => {
    const memberId = "7a1c2a3e-0000-4000-8000-00000000aaaa";
    const res = await request(app)
      .post("/groups")
      .set(bearer(luka))
      .send({ name: "Offline trip", creatorMember: { id: memberId, name: "Luka B." } });
    expect(res.status).toBe(201);
    expect(res.body.members).toEqual([expect.objectContaining({ id: memberId, name: "Luka B.", userId: luka.id })]);
    const dup = await request(app).post("/groups").set(bearer(nino)).send({ name: "Other", creatorMember: { id: memberId, name: "X" } });
    expect(dup.status).toBe(409);
  });

  it("requires authentication and a name", async () => {
    expect((await request(app).post("/groups").send({ name: "x" })).status).toBe(401);
    expect((await request(app).post("/groups").set(bearer(luka)).send({ name: "  " })).status).toBe(400);
    expect((await request(app).post("/groups").set(bearer(luka)).send({ name: "x", currency: "USD" })).status).toBe(400);
  });
});

describe("GET /groups and /groups/:id", () => {
  it("lists only groups the caller belongs to", async () => {
    const mine = await createGroup(luka, "Mine");
    await createGroup(nino, "Theirs");
    const res = await request(app).get("/groups").set(bearer(luka));
    expect(res.status).toBe(200);
    expect(res.body.groups.map((g: { group: { id: string } }) => g.group.id)).toEqual([mine.group.id]);
  });

  it("returns 404 for a group the caller is not in, same as a missing id", async () => {
    const { group } = await createGroup(luka);
    const foreign = await request(app).get(`/groups/${group.id}`).set(bearer(nino));
    const missing = await request(app).get("/groups/7a1c2a3e-0000-4000-8000-0000000000ff").set(bearer(nino));
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
  });

  it("rejects a malformed group id with 400", async () => {
    expect((await request(app).get("/groups/not-a-uuid").set(bearer(luka))).status).toBe(400);
  });
});

describe("PATCH and DELETE /groups/:id", () => {
  it("renames and soft-deletes", async () => {
    const { group } = await createGroup(luka);
    const renamed = await request(app).patch(`/groups/${group.id}`).set(bearer(luka)).send({ name: "Svaneti" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.group.name).toBe("Svaneti");

    expect((await request(app).delete(`/groups/${group.id}`).set(bearer(luka))).status).toBe(204);
    expect((await request(app).get(`/groups/${group.id}`).set(bearer(luka))).status).toBe(404);
    const row = await db.group.findUnique({ where: { id: group.id } });
    expect(row?.deletedAt).not.toBeNull();
  });
});

describe("members", () => {
  it("adds, renames and removes an unclaimed member", async () => {
    const { group } = await createGroup(luka);
    const added = await request(app).post(`/groups/${group.id}/members`).set(bearer(luka)).send({ name: "Giorgi" });
    expect(added.status).toBe(201);
    const giorgi = memberSchema.parse(added.body.member);
    expect(giorgi.userId).toBeNull();

    const renamed = await request(app).patch(`/groups/${group.id}/members/${giorgi.id}`).set(bearer(luka)).send({ name: "Gio" });
    expect(renamed.body.member.name).toBe("Gio");

    expect((await request(app).delete(`/groups/${group.id}/members/${giorgi.id}`).set(bearer(luka))).status).toBe(204);
    const after = await request(app).get(`/groups/${group.id}`).set(bearer(luka));
    expect(after.body.members.map((m: { name: string }) => m.name)).toEqual(["Luka"]);
  });

  it("refuses to remove a member another account has claimed", async () => {
    const { group } = await createGroup(luka);
    await request(app).post(`/invites/${group.inviteCode}/join`).set(bearer(nino)).send({ name: "Nino" });
    const ninoMember = (await request(app).get(`/groups/${group.id}`).set(bearer(luka))).body.members.find(
      (m: { userId: string | null }) => m.userId === nino.id,
    );
    const res = await request(app).delete(`/groups/${group.id}/members/${ninoMember.id}`).set(bearer(luka));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("MEMBER_CLAIMED");
  });

  it("non-members cannot add members", async () => {
    const { group } = await createGroup(luka);
    const res = await request(app).post(`/groups/${group.id}/members`).set(bearer(nino)).send({ name: "Sneaky" });
    expect(res.status).toBe(404);
  });
});

describe("invites", () => {
  it("previews the group and its unclaimed members", async () => {
    const { group } = await createGroup(luka);
    await request(app).post(`/groups/${group.id}/members`).set(bearer(luka)).send({ name: "Nino" });
    const res = await request(app).get(`/invites/${group.inviteCode}`).set(bearer(nino));
    expect(res.status).toBe(200);
    const preview = invitePreviewSchema.parse(res.body);
    expect(preview.group).toEqual({ id: group.id, name: group.name, currency: "GEL" });
    expect(preview.unclaimedMembers.map((m) => m.name)).toEqual(["Nino"]);
    expect(preview.alreadyMemberId).toBeNull();
  });

  it("lets a user claim an existing member slot", async () => {
    const { group } = await createGroup(luka);
    const slot = (await request(app).post(`/groups/${group.id}/members`).set(bearer(luka)).send({ name: "Nino" })).body.member;
    const res = await request(app).post(`/invites/${group.inviteCode}/join`).set(bearer(nino)).send({ memberId: slot.id });
    expect(res.status).toBe(200);
    const { members } = groupWithMembersSchema.parse(res.body);
    expect(members.find((m) => m.id === slot.id)?.userId).toBe(nino.id);

    const claimedAgain = await request(app).post(`/invites/${group.inviteCode}/join`).set(bearer(luka)).send({ memberId: slot.id });
    expect(claimedAgain.status).toBe(200); // Luka is already a member; join is idempotent and does not steal the slot
    const stillNino = await db.member.findUnique({ where: { id: slot.id } });
    expect(stillNino?.userId).toBe(nino.id);
  });

  it("lets a user join under a new name, and joining twice is idempotent", async () => {
    const { group } = await createGroup(luka);
    const first = await request(app).post(`/invites/${group.inviteCode}/join`).set(bearer(nino)).send({ name: "Nino" });
    const second = await request(app).post(`/invites/${group.inviteCode}/join`).set(bearer(nino)).send({ name: "Nino again" });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.members).toHaveLength(2);
    const preview = await request(app).get(`/invites/${group.inviteCode}`).set(bearer(nino));
    expect(preview.body.alreadyMemberId).not.toBeNull();
  });

  it("rejects claiming a slot another account already holds", async () => {
    const { group } = await createGroup(luka);
    const lukaMember = (await request(app).get(`/groups/${group.id}`).set(bearer(luka))).body.members[0];
    const res = await request(app).post(`/invites/${group.inviteCode}/join`).set(bearer(nino)).send({ memberId: lukaMember.id });
    expect(res.status).toBe(409);
  });

  it("rejects unknown, malformed and deleted-group codes", async () => {
    expect((await request(app).get("/invites/ZZZZ9999").set(bearer(nino))).status).toBe(404);
    expect((await request(app).get("/invites/short").set(bearer(nino))).status).toBe(400);
    const { group } = await createGroup(luka);
    await request(app).delete(`/groups/${group.id}`).set(bearer(luka));
    expect((await request(app).get(`/invites/${group.inviteCode}`).set(bearer(nino))).status).toBe(404);
  });
});
