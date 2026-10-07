import express from "express";
import { pino } from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../errors.js";
import { invitePageRouter } from "./page.js";

const app = express();
app.use(invitePageRouter());
app.use(errorHandler(pino({ level: "silent" })));

describe("GET /i/:code", () => {
  it("serves a page with the code and a deep link into the app", async () => {
    const res = await request(app).get("/i/kazb2326");
    expect(res.status).toBe(200);
    expect(res.type).toBe("text/html");
    expect(res.text).toContain("KAZB2326");
    expect(res.text).toContain('href="tsili://join?code=KAZB2326"');
  });

  it("rejects anything that is not a well-formed code", async () => {
    expect((await request(app).get("/i/short")).status).toBe(404);
    expect((await request(app).get("/i/ABCD0123")).status).toBe(404); // 0 is not in the alphabet
    expect((await request(app).get("/i/%3Cscript%3E")).status).toBe(404);
  });
});
