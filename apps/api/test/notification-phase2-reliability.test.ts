import {randomUUID} from "node:crypto";
import {describe,expect,it} from "vitest";
import {NotificationService} from "../src/modules/notifications/notification.service.js";
import {FakeNotificationRepository} from "./fake-notification-repository.js";

describe("Notifications Phase 2 — visibility, keyset paging, unread consistency",()=>{
  it("paginates equal timestamps with deterministic id tie-breaks and ignores newly inserted first-page rows",async()=>{
    const repo=new FakeNotificationRepository();
    let now=new Date("2026-10-14T00:00:00.000Z");
    const service=new NotificationService(repo,()=>now);
    const user=randomUUID(),other=randomUUID();
    for(let i=0;i<5;i++)await service.bookingCancelled({
      userId:user,bookingId:randomUUID(),venueName:"Arena "+i,
    });
    await service.bookingCancelled({userId:other,bookingId:randomUUID(),venueName:"Foreign"});
    const first=await service.list(user,"ALL",2);
    expect(first.notifications).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toBeTruthy();
    expect(first.unreadCount).toBe(5);
    now=new Date("2026-10-14T00:00:01.000Z");
    await service.bookingCancelled({userId:user,bookingId:randomUUID(),venueName:"Brand new"});
    const second=await service.list(user,"ALL",2,0,first.nextCursor!);
    const third=await service.list(user,"ALL",2,0,second.nextCursor!);
    const ids=[...first.notifications,...second.notifications,...third.notifications].map(x=>x.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(second.hasMore).toBe(true);
    expect(third.hasMore).toBe(false);
    expect(third.nextCursor).toBeNull();
    expect((await service.list(user)).notifications[0]?.body).toContain("Brand new");
    expect(second.unreadCount).toBe(6);
    expect((await service.list(other)).notifications).toHaveLength(1);
    await expect(service.list(user,"ALL",2,0,"invalid")).rejects.toMatchObject({
      code:"INVALID_NOTIFICATION_CURSOR",
    });
    await expect(service.list(user,"ALL",2,0,Buffer.from("2026-10-14T00:00:00.000Z|no-id").toString("base64url")))
      .rejects.toMatchObject({code:"INVALID_NOTIFICATION_CURSOR"});
  });
  it("shows in-app events only; push-only events do not increase inbox or badge counts",async()=>{
    const repo=new FakeNotificationRepository(),service=new NotificationService(repo);
    const user=randomUUID();
    await repo.registerDevice(user,{expoPushToken:"ExpoPushToken[push-token-phase2-valid]",platform:"ANDROID"},new Date());
    const bookingId=randomUUID();
    await service.bookingCancelled({userId:user,bookingId,venueName:"In-app"});
    await service.updatePreferences(user,{inAppEnabled:false,pushEnabled:true});
    await service.bookingCancelled({userId:user,bookingId:randomUUID(),venueName:"Push only"});
    const all=await service.list(user);
    expect(all.total).toBe(1);
    expect(all.notifications).toHaveLength(1);
    expect(all.notifications[0]?.body).toContain("In-app");
    expect(all.unreadCount).toBe(1);
    expect((await service.unreadCount(user)).unreadCount).toBe(1);
    expect(repo.notifications).toHaveLength(2);
    const extra=repo.notifications.find(x=>x.body.includes("Push only"))!;
    expect(repo.deliveries.filter(x=>x.notificationId===extra.id).map(x=>x.channel)).toEqual(["PUSH"]);
    expect(await service.markAllRead(user)).toMatchObject({updated:1,unreadCount:0});
    expect((await service.list(user,"UNREAD")).total).toBe(0);
    expect(repo.notifications.find(x=>x.id===extra.id)?.readAt).toBeNull();
  });
  it("uses server unread counts for repeated mark-read and preserves first read timestamp",async()=>{
    const repo=new FakeNotificationRepository(),service=new NotificationService(repo,
      ()=>new Date("2026-10-14T01:00:00.000Z"));
    const user=randomUUID(),stranger=randomUUID();
    await service.teamInvitation({userId:user,invitationId:randomUUID(),teamId:randomUUID(),teamName:"Blue"});
    const item=(await service.list(user)).notifications[0]!;
    const first=await service.markRead(user,item.id);
    expect(first.notification.readAt).toBe("2026-10-14T01:00:00.000Z");
    expect(first.unreadCount).toBe(0);
    const retry=await service.markRead(user,item.id);
    expect(retry.notification.readAt).toBe(first.notification.readAt);
    expect(retry.unreadCount).toBe(0);
    await expect(service.markRead(stranger,item.id)).rejects.toMatchObject({code:"NOTIFICATION_NOT_FOUND"});
    expect((await service.unreadCount(stranger)).unreadCount).toBe(0);
  });
});
