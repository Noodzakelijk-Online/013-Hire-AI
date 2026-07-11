import { describe, expect, it } from "vitest";
import {
  createAdminReviewItem,
  createAuditEvent,
  getAuditEventsForEntity,
  getAuditEventsForUser,
  listAdminReviewItems,
  resolveAdminReviewItem,
} from "./db";

describe("audit and admin review ledger", () => {
  it("records audit events for a user-owned entity", async () => {
    const userId = 97001;
    const entityId = 12345;

    await createAuditEvent({
      userId,
      entityType: "application",
      entityId,
      action: "application_submission_confirmed",
      actor: "user",
      source: "test",
      riskLevel: "high",
      afterState: JSON.stringify({ status: "applied" }),
    });

    const events = await getAuditEventsForEntity(userId, "application", entityId);

    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("application_submission_confirmed");
    expect(events[0].riskLevel).toBe("high");
  });

  it("lists recent audit events for one user without leaking other users", async () => {
    const userId = 97003;
    const otherUserId = 97004;

    await createAuditEvent({
      userId,
      entityType: "application",
      entityId: 1,
      action: "application_prepared",
      actor: "system",
      source: "test",
      riskLevel: "medium",
    });
    await createAuditEvent({
      userId,
      entityType: "application",
      entityId: 2,
      action: "approval_requested",
      actor: "system",
      source: "test",
      riskLevel: "high",
    });
    await createAuditEvent({
      userId: otherUserId,
      entityType: "application",
      entityId: 3,
      action: "other_user_event",
      actor: "system",
      source: "test",
      riskLevel: "low",
    });

    const events = await getAuditEventsForUser(userId, 10);

    expect(events.map((event) => event.userId).every((id) => id === userId)).toBe(true);
    expect(events.map((event) => event.action)).toEqual(
      expect.arrayContaining(["application_prepared", "approval_requested"])
    );
    expect(events.some((event) => event.action === "other_user_event")).toBe(false);
  });

  it("keeps one open review item per user/entity/category and resolves it", async () => {
    const userId = 97002;
    const entityId = 54321;

    const first = await createAdminReviewItem({
      userId,
      entityType: "application",
      entityId,
      category: "application_review",
      priority: "medium",
      title: "Review prepared application",
      description: "Initial review required.",
    });
    const second = await createAdminReviewItem({
      userId,
      entityType: "application",
      entityId,
      category: "application_review",
      priority: "high",
      title: "High-risk prepared application",
      description: "Updated review reason.",
    });

    const openItems = await listAdminReviewItems("open");
    const item = openItems.find((review) => review.id === Number(first.insertId));

    expect(second.existing).toBe(true);
    expect(item?.priority).toBe("high");
    expect(item?.title).toBe("High-risk prepared application");

    await resolveAdminReviewItem(Number(first.insertId), 1, "resolved", "Reviewed and approved.");

    const remainingOpenItems = await listAdminReviewItems("open");
    expect(remainingOpenItems.some((review) => review.id === Number(first.insertId))).toBe(false);
  });
});
