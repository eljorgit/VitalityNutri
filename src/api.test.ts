import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import express from "express";
import supertest from "supertest";
import cors from "cors";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vitest-api-"));
let closeDb: () => void;

beforeAll(async () => {
  const prevCwd = process.cwd();
  process.chdir(tmpDir);
  const dbMod = await import("./db");
  closeDb = dbMod.closeDb;
  process.chdir(prevCwd);
});

afterAll(() => {
  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function createTestApp() {
  const { getPlan, savePlan, resetPlan, getGroceryListState, saveGroceryListState, getHistory } = await import("./db");

  const app = express();
  app.use(express.json());
  app.use(cors());

  app.get("/api/plan", (_req, res) => {
    const result = getPlan();
    res.json(result);
  });

  app.post("/api/plan/reset", (_req, res) => {
    resetPlan();
    res.json({ success: true });
  });

  app.get("/api/grocery-list", (_req, res) => {
    const state = getGroceryListState();
    res.json({ state });
  });

  app.post("/api/grocery-list", (req, res) => {
    saveGroceryListState(req.body);
    res.json({ success: true });
  });

  app.get("/api/history", (_req, res) => {
    const history = getHistory();
    res.json(history);
  });

  return app;
}

describe("API Endpoints (core data)", () => {
  let app: express.Application;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it("GET /api/plan returns plan and metadata", async () => {
    const res = await supertest(app).get("/api/plan");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("plan");
    expect(res.body).toHaveProperty("metadata");
  });

  it("POST /api/plan/reset succeeds", async () => {
    const res = await supertest(app).post("/api/plan/reset");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /api/grocery-list returns state", async () => {
    const res = await supertest(app).get("/api/grocery-list");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("state");
  });

  it("POST /api/grocery-list saves state", async () => {
    const testState = {
      checkedItems: { test: true },
      listType: "semanal",
      selectedSingleDay: "",
      selected3DaysStart: "",
      excludedMeals: [],
      multipliers: {},
    };
    const res = await supertest(app).post("/api/grocery-list").send(testState);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /api/history returns an array", async () => {
    const res = await supertest(app).get("/api/history");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
