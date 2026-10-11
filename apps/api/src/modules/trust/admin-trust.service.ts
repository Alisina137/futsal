import type {Database} from "@leaguekick/database";
import {and,asc,desc,eq,isNull,lt,sql} from "drizzle-orm";
import {
  auditLogs,communityReports,notificationDeliveries,notifications,notificationPreferences,
  platformAnnouncements,platformAnnouncementRecipients,
  socialPostComments,socialPosts,supportTicketEvents,supportTickets,
  userRoles,users,venuePosts,venuePromotions,venues,
} from "@leaguekick/database";
import type {AdminPhase6Page} from "@leaguekick/contracts";
import {errors} from "../../lib/errors.js";

type ModerationKind="POST"|"COMMENT"|"PROMOTION"|"USER";
type ReportTarget="USER"|"VENUE"|"POST"|"COMMENT"|"PROMOTION";
type ReportStatus="OPEN"|"REVIEWING"|"RESOLVED"|"DISMISSED";
type TicketState="OPEN"|"IN_PROGRESS"|"WAITING_FOR_USER"|"RESOLVED"|"CLOSED";
type TicketPriority="LOW"|"NORMAL"|"HIGH"|"URGENT";
type Audience="ALL"|"USER"|"ROLE"|"CITY";
const paging=(p:AdminPhase6Page)=>({limit:p.pageSize,offset:(p.page-1)*p.pageSize});
function okType(t:string, values:readonly string[]){
  if(!values.includes(t))throw errors.badRequest("INVALID_FILTER","Invalid filter value.");
}
function limitPage<T>(items:T[],total:number,p:AdminPhase6Page){
  return {items,total,page:p.page,pageSize:p.pageSize,hasMore:p.page*p.pageSize<total};
}
function conflict(e:unknown){
  const v=e as {code?:string;cause?:{code?:string}};
  return v?.code==="23505"||v?.cause?.code==="23505";
}
export class AdminTrustService{
  constructor(private readonly db:Database,private readonly now:()=>Date=()=>new Date()){}

  /** Bounded moderation inventory: image URLs, post body, comments and discounts.
   * Private content stays exclusively in this PLATFORM_ADMIN-guarded endpoint. */
  async moderation(p:AdminPhase6Page){
    if(p.kind)okType(p.kind,["POST","COMMENT","PROMOTION"]);
    if(p.status)okType(p.status,["PUBLISHED","UNPUBLISHED","HIDDEN","ACTIVE","CLOSED","EXPIRED"]);
    const condition=sql.join([
      sql`true`,p.kind?sql`kind=${p.kind}`:sql`true`,
      p.status?sql`status=${p.status}`:sql`true`,
      p.q?sql`(body ILIKE ${"%"+p.q+"%"} OR author ILIKE ${"%"+p.q+"%"})`:sql`true`,
    ],sql` AND `);
    const base=sql`WITH moderation_items AS (
      SELECT sp.id,'POST'::text kind,sp.body::text body,sp.image_url::text "imageUrl",
        sp.status::text status,u.display_name::text author,sp.created_by_user_id "authorUserId",
        sp.created_at "createdAt"
      FROM social_posts sp INNER JOIN users u ON u.id=sp.created_by_user_id
      UNION ALL
      SELECT c.id,'COMMENT',c.body,NULL::text,
        CASE WHEN c.hidden_at IS NULL THEN 'PUBLISHED' ELSE 'HIDDEN' END,
        u.display_name,c.user_id,c.created_at
      FROM social_post_comments c INNER JOIN users u ON u.id=c.user_id
      UNION ALL
      SELECT pr.id,'PROMOTION',pr.title::text, NULL::text,pr.status::text,
        v.name::text,pr.created_by_user_id,pr.created_at
      FROM venue_promotions pr INNER JOIN venues v ON v.id=pr.venue_id
    )`;
    const [rows,totals]=await Promise.all([
      this.db.execute(sql`${base} SELECT * FROM moderation_items WHERE ${condition}
        ORDER BY "createdAt" DESC,id DESC LIMIT ${p.pageSize} OFFSET ${paging(p).offset}`),
      this.db.execute(sql`${base} SELECT count(*)::int total FROM moderation_items WHERE ${condition}`),
    ]);
    return limitPage(rows.rows,Number(totals.rows[0]?.total??0),p);
  }
  async moderate(actor:string,kind:ModerationKind,id:string,action:"HIDE"|"CLOSE"|"WARN",reason:string){
    const now=this.now();
    await this.db.transaction(async tx=>{
      if(kind==="USER"&&action==="WARN"){
        const [target]=await tx.select({id:users.id,status:users.status}).from(users)
          .where(eq(users.id,id)).for("update").limit(1);
        if(!target||target.status!=="ACTIVE")
          throw errors.badRequest("USER_NOT_FOUND","Only active users can be warned.");
        // Account warnings are direct, deduplicated in-app notices, never role changes.
        await tx.insert(notifications).values({
          userId:id,type:"ADMIN_ANNOUNCEMENT",title:"Account notice",body:reason,
          deepLink:"/support",dedupeKey:"admin-warning:"+actor+":"+id+":"+now.getTime(),
          data:{moderation:true,action:"WARN"},createdAt:now,
        }).onConflictDoNothing();
      }else if(kind==="POST"&&action==="HIDE"){
        const [post]=await tx.select().from(socialPosts)
          .where(eq(socialPosts.id,id)).for("update").limit(1);
        if(!post)throw errors.badRequest("POST_NOT_FOUND","Post not found.");
        if(post.status!=="PUBLISHED")throw errors.conflict("ALREADY_HIDDEN","Post is not published.");
        await tx.update(socialPosts).set({status:"UNPUBLISHED",unpublishedAt:now,updatedAt:now})
          .where(eq(socialPosts.id,id));
        if(post.legacyVenuePostId)await tx.update(venuePosts).set({
          status:"UNPUBLISHED",unpublishedAt:now,updatedAt:now,
        }).where(eq(venuePosts.id,post.legacyVenuePostId));
      }else if(kind==="COMMENT"&&action==="HIDE"){
        const [comment]=await tx.select().from(socialPostComments)
          .where(eq(socialPostComments.id,id)).for("update").limit(1);
        if(!comment)throw errors.badRequest("COMMENT_NOT_FOUND","Comment not found.");
        if(comment.hiddenAt)throw errors.conflict("ALREADY_HIDDEN","Comment is hidden.");
        await tx.update(socialPostComments).set({hiddenAt:now}).where(eq(socialPostComments.id,id));
      }else if(kind==="PROMOTION"&&action==="CLOSE"){
        const [promotion]=await tx.select().from(venuePromotions)
          .where(eq(venuePromotions.id,id)).for("update").limit(1);
        if(!promotion)throw errors.badRequest("PROMOTION_NOT_FOUND","Promotion not found.");
        if(promotion.status!=="ACTIVE")throw errors.conflict("PROMOTION_INACTIVE","Promotion is not active.");
        await tx.update(venuePromotions).set({status:"CLOSED",closedAt:now,
          closeReason:"ADMIN_MODERATION",updatedAt:now}).where(eq(venuePromotions.id,id));
      }else throw errors.badRequest("INVALID_MODERATION_ACTION","This action is not allowed on that target.");
      await tx.insert(auditLogs).values({actorUserId:actor,
        action:"ADMIN_MODERATION_"+action,targetType:kind,targetId:id,
        metadata:{reason},createdAt:now});
    });
  }
  private async targetExists(kind:ReportTarget,id:string){
    if(kind==="USER")return (await this.db.select({id:users.id}).from(users).where(eq(users.id,id)).limit(1)).length>0;
    if(kind==="VENUE")return (await this.db.select({id:venues.id}).from(venues).where(eq(venues.id,id)).limit(1)).length>0;
    if(kind==="POST")return (await this.db.select({id:socialPosts.id}).from(socialPosts).where(eq(socialPosts.id,id)).limit(1)).length>0;
    if(kind==="COMMENT")return (await this.db.select({id:socialPostComments.id}).from(socialPostComments).where(eq(socialPostComments.id,id)).limit(1)).length>0;
    return (await this.db.select({id:venuePromotions.id}).from(venuePromotions).where(eq(venuePromotions.id,id)).limit(1)).length>0;
  }
  async submitReport(actor:string,input:{targetType:ReportTarget;targetId:string;category:string;description:string}){
    if(!await this.targetExists(input.targetType,input.targetId))
      throw errors.badRequest("TARGET_NOT_FOUND","Reported record not found.");
    try{
      const [row]=await this.db.insert(communityReports).values({
        reporterUserId:actor,...input,createdAt:this.now(),updatedAt:this.now(),
      }).returning({id:communityReports.id});
      return {id:row!.id,status:"OPEN"};
    }catch(e){if(conflict(e))throw errors.conflict("REPORT_EXISTS","You have an open report for this item.");throw e;}
  }
  async reports(p:AdminPhase6Page){
    if(p.status)okType(p.status,["OPEN","REVIEWING","RESOLVED","DISMISSED"]);
    if(p.kind)okType(p.kind,["USER","VENUE","POST","COMMENT","PROMOTION"]);
    const where=and(p.status?eq(communityReports.status,p.status):undefined,
      p.kind?eq(communityReports.targetType,p.kind):undefined);
    const [rows,totals]=await Promise.all([
      this.db.select().from(communityReports).where(where)
        .orderBy(desc(communityReports.createdAt),desc(communityReports.id))
        .limit(p.pageSize).offset(paging(p).offset),
      this.db.execute(sql`SELECT count(*)::int total FROM community_reports
        WHERE (${p.status??null}::text IS NULL OR status=${p.status??null})
          AND (${p.kind??null}::text IS NULL OR target_type=${p.kind??null})`),
    ]);
    return limitPage(rows,Number(totals.rows[0]?.total??0),p);
  }
  async reviewReport(actor:string,id:string,status:Exclude<ReportStatus,"OPEN">,note:string){
    const now=this.now();
    return this.db.transaction(async tx=>{
      const [r]=await tx.select().from(communityReports)
        .where(eq(communityReports.id,id)).for("update").limit(1);
      if(!r)throw errors.badRequest("REPORT_NOT_FOUND","Report not found.");
      if(r.status==="RESOLVED"||r.status==="DISMISSED")
        throw errors.conflict("REPORT_CLOSED","Closed reports cannot be reopened.");
      if(status==="REVIEWING"&&r.status==="REVIEWING")
        throw errors.conflict("REPORT_UNCHANGED","Report is already being reviewed.");
      const [updated]=await tx.update(communityReports).set({
        status,resolutionNote:note,reviewedByUserId:actor,updatedAt:now,
      }).where(eq(communityReports.id,id)).returning();
      await tx.insert(auditLogs).values({
        actorUserId:actor,action:"ADMIN_REPORT_"+status,targetType:r.targetType,
        targetId:r.targetId,metadata:{reportId:id,reason:note,previousStatus:r.status},createdAt:now});
      return updated!;
    });
  }
  async createTicket(actor:string,input:{category:string;subject:string;description:string}){
    const now=this.now();
    return this.db.transaction(async tx=>{
      const [row]=await tx.insert(supportTickets).values({
        requesterUserId:actor,...input,createdAt:now,updatedAt:now,
      }).returning();
      await tx.insert(supportTicketEvents).values({
        ticketId:row!.id,actorUserId:actor,action:"CREATED",
        note:input.description,nextStatus:"OPEN",createdAt:now,
      });
      return row!;
    });
  }
  async tickets(p:AdminPhase6Page,requesterId?:string){
    if(p.status)okType(p.status,["OPEN","IN_PROGRESS","WAITING_FOR_USER","RESOLVED","CLOSED"]);
    const where=and(requesterId?eq(supportTickets.requesterUserId,requesterId):undefined,
      p.status?eq(supportTickets.status,p.status):undefined);
    const [rows,count]=await Promise.all([
      this.db.select().from(supportTickets).where(where)
        .orderBy(desc(supportTickets.updatedAt),desc(supportTickets.id))
        .limit(p.pageSize).offset(paging(p).offset),
      this.db.select({total:sql<number>`count(*)::int`}).from(supportTickets).where(where),
    ]);
    return limitPage(rows,Number(count[0]?.total??0),p);
  }
  async ticketDetail(id:string,viewerId:string,admin:boolean){
    const [ticket]=await this.db.select().from(supportTickets)
      .where(eq(supportTickets.id,id)).limit(1);
    if(!ticket||(!admin&&ticket.requesterUserId!==viewerId))
      throw errors.badRequest("TICKET_NOT_FOUND","Support ticket not found.");
    const events=await this.db.select().from(supportTicketEvents)
      .where(eq(supportTicketEvents.ticketId,id)).orderBy(asc(supportTicketEvents.createdAt))
      .limit(200);
    return {ticket,events};
  }
  async replyTicket(actor:string,id:string,note:string,isAdmin=false){
    const now=this.now();
    return this.db.transaction(async tx=>{
      const [t]=await tx.select().from(supportTickets).where(eq(supportTickets.id,id)).for("update").limit(1);
      if(!t||(!isAdmin&&t.requesterUserId!==actor))
        throw errors.badRequest("TICKET_NOT_FOUND","Support ticket not found.");
      if(t.status==="CLOSED")throw errors.conflict("TICKET_CLOSED","Closed tickets cannot be replied to.");
      const next:TicketState=!isAdmin&&t.status==="WAITING_FOR_USER"?"IN_PROGRESS":t.status as TicketState;
      await tx.update(supportTickets).set({status:next,updatedAt:now}).where(eq(supportTickets.id,id));
      await tx.insert(supportTicketEvents).values({ticketId:id,actorUserId:actor,
        action:"REPLY",note,previousStatus:t.status,nextStatus:next,createdAt:now});
      return {updated:true};
    });
  }
  async updateTicket(actor:string,id:string,input:{
    status:TicketState;priority:TicketPriority;assignedToUserId:string|null;note:string;
  }){
    const now=this.now();
    return this.db.transaction(async tx=>{
      const [prior]=await tx.select().from(supportTickets).where(eq(supportTickets.id,id))
        .for("update").limit(1);
      if(!prior)throw errors.badRequest("TICKET_NOT_FOUND","Support ticket not found.");
      if(prior.status==="CLOSED")throw errors.conflict("TICKET_CLOSED","Closed tickets are immutable.");
      if(input.status==="OPEN"&&prior.status!=="OPEN")
        throw errors.conflict("INVALID_TICKET_TRANSITION","Tickets cannot return to Open.");
      if(input.status==="WAITING_FOR_USER"&&prior.status!=="IN_PROGRESS")
        throw errors.conflict("INVALID_TICKET_TRANSITION","Ticket must be in progress first.");
      if(input.status==="CLOSED"&&prior.status!=="RESOLVED")
        throw errors.conflict("INVALID_TICKET_TRANSITION","Resolve a ticket before closing it.");
      if(input.assignedToUserId){
        const [assigned]=await tx.select({id:userRoles.userId}).from(userRoles)
          .where(and(eq(userRoles.userId,input.assignedToUserId),
            eq(userRoles.role,"PLATFORM_ADMIN"))).limit(1);
        if(!assigned)throw errors.badRequest("ASSIGNEE_NOT_ADMIN","Assignee must be a platform administrator.");
      }
      const [updated]=await tx.update(supportTickets).set({
        status:input.status,priority:input.priority,assignedToUserId:input.assignedToUserId,
        updatedAt:now,closedAt:input.status==="CLOSED"?now:null,
      }).where(eq(supportTickets.id,id)).returning();
      await tx.insert(supportTicketEvents).values({
        ticketId:id,actorUserId:actor,action:"UPDATED",note:input.note,
        previousStatus:prior.status,nextStatus:input.status,createdAt:now,
      });
      await tx.insert(auditLogs).values({actorUserId:actor,action:"SUPPORT_TICKET_UPDATED",
        targetType:"SUPPORT_TICKET",targetId:id,
        metadata:{reason:input.note,previousStatus:prior.status,nextStatus:input.status,
          previousPriority:prior.priority,nextPriority:input.priority,
          assignedToUserId:input.assignedToUserId},createdAt:now});
      return updated!;
    });
  }
  async announce(actor:string,input:{
    title:string;body:string;audience:Audience;audienceValue:string|null;scheduledAt:string;
  }){
    const scheduledAt=new Date(input.scheduledAt),now=this.now();
    if(!Number.isFinite(scheduledAt.getTime()))
      throw errors.badRequest("INVALID_SCHEDULE","Invalid scheduled time.");
    if(scheduledAt.getTime()<now.getTime()-60_000||
       scheduledAt.getTime()>now.getTime()+365*86400000)
      throw errors.badRequest("INVALID_SCHEDULE","Schedule must be now through one year ahead.");
    if(input.audience==="USER"){
      const [u]=await this.db.select({id:users.id}).from(users).where(eq(users.id,input.audienceValue!)).limit(1);
      if(!u)throw errors.badRequest("USER_NOT_FOUND","Target user not found.");
    }
    if(input.audience==="ROLE")okType(input.audienceValue!,["PLAYER","VENUE_OWNER","TEAM_MANAGER","REFEREE","PLATFORM_ADMIN"]);
    const created=await this.db.transaction(async tx=>{
      const [a]=await tx.insert(platformAnnouncements).values({
        title:input.title,body:input.body,audience:input.audience,audienceValue:input.audienceValue,
        scheduledAt,createdByUserId:actor,createdAt:now,
      }).returning();
      await tx.insert(auditLogs).values({actorUserId:actor,action:"ADMIN_ANNOUNCEMENT_CREATED",
        targetType:"ANNOUNCEMENT",targetId:a!.id,
        metadata:{audience:input.audience,audienceValue:input.audienceValue,
          scheduledAt:scheduledAt.toISOString()},createdAt:now});
      return a!;
    });
    // Tick starts immediately for now announcements; scheduled announcements
    // are processed by the production interval (not a user notification promise).
    if(scheduledAt<=now)await this.dispatchDue();
    return created;
  }
  async listAnnouncements(p:AdminPhase6Page){
    if(p.status)okType(p.status,["SCHEDULED","SENDING","SENT","CANCELLED"]);
    const where=p.status?eq(platformAnnouncements.status,p.status):undefined;
    const [records,totals]=await Promise.all([
      this.db.select().from(platformAnnouncements).where(where)
        .orderBy(desc(platformAnnouncements.createdAt)).limit(p.pageSize).offset(paging(p).offset),
      this.db.select({n:sql<number>`count(*)::int`}).from(platformAnnouncements).where(where),
    ]);
    const items=await Promise.all(records.map(async a=>{
      const counts=await this.db.select({total:sql<number>`count(*)::int`,
        delivered:sql<number>`count(delivered_at)::int`}).from(platformAnnouncementRecipients)
        .where(eq(platformAnnouncementRecipients.announcementId,a.id));
      return {...a,totalRecipients:counts[0]?.total??0,deliveredRecipients:counts[0]?.delivered??0};
    }));
    return limitPage(items,Number(totals[0]?.n??0),p);
  }
  async cancelAnnouncement(actor:string,id:string,reason:string){
    const now=this.now();
    await this.db.transaction(async tx=>{
      const [a]=await tx.select().from(platformAnnouncements)
        .where(eq(platformAnnouncements.id,id)).for("update").limit(1);
      if(!a)throw errors.badRequest("ANNOUNCEMENT_NOT_FOUND","Campaign not found.");
      if(a.status!=="SCHEDULED")throw errors.conflict("CAMPAIGN_STARTED","Only unsent announcements can be cancelled.");
      await tx.update(platformAnnouncements).set({status:"CANCELLED",completedAt:now})
        .where(eq(platformAnnouncements.id,id));
      await tx.insert(auditLogs).values({actorUserId:actor,action:"ADMIN_ANNOUNCEMENT_CANCELLED",
        targetType:"ANNOUNCEMENT",targetId:id,metadata:{reason},createdAt:now});
    });
  }

  /** Durable audience snapshot + per-user dedupe. Each tick commits <=150
   * notifications per campaign. Parallel API instances coordinate by row lock. */
  async dispatchDue(){
    const now=this.now();
    const due=await this.db.select({id:platformAnnouncements.id}).from(platformAnnouncements)
      .where(and(sql`${platformAnnouncements.status} IN ('SCHEDULED','SENDING')`,
        lt(platformAnnouncements.scheduledAt,new Date(now.getTime()+1000))))
      .orderBy(asc(platformAnnouncements.scheduledAt)).limit(6);
    for(const dueId of due){
      await this.db.transaction(async tx=>{
        const [a]=await tx.select().from(platformAnnouncements)
          .where(eq(platformAnnouncements.id,dueId.id)).for("update").limit(1);
        if(!a||!["SCHEDULED","SENDING"].includes(a.status))return;
        if(a.status==="SCHEDULED"){
          const audience= a.audience==="USER"?sql`u.id::text=${a.audienceValue}`
            :a.audience==="CITY"?sql`u.city=${a.audienceValue}`
            :a.audience==="ROLE"?sql`EXISTS (SELECT 1 FROM user_roles ur
              WHERE ur.user_id=u.id AND ur.role::text=${a.audienceValue})`
            :sql`true`;
          await tx.execute(sql`INSERT INTO platform_announcement_recipients
            (announcement_id,user_id) SELECT ${a.id},u.id FROM users u
            WHERE u.status='ACTIVE' AND ${audience}
            ON CONFLICT DO NOTHING`);
          await tx.update(platformAnnouncements).set({status:"SENDING",startedAt:now})
            .where(eq(platformAnnouncements.id,a.id));
        }
        const recipients=await tx.select({userId:platformAnnouncementRecipients.userId})
          .from(platformAnnouncementRecipients)
          .where(and(eq(platformAnnouncementRecipients.announcementId,a.id),
            isNull(platformAnnouncementRecipients.deliveredAt)))
          .orderBy(asc(platformAnnouncementRecipients.userId)).limit(150);
        for(const recipient of recipients){
          const key="admin-announcement:"+a.id;
          const [notice]=await tx.insert(notifications).values({
            userId:recipient.userId,type:"ADMIN_ANNOUNCEMENT",title:a.title,body:a.body,
            deepLink:"/notifications",data:{announcementId:a.id},dedupeKey:key,createdAt:now,
          }).onConflictDoNothing().returning({id:notifications.id});
          if(notice)await tx.insert(notificationDeliveries).values({
            notificationId:notice.id,channel:"IN_APP",status:"SENT",
            attempts:1,lastAttemptAt:now,
          }).onConflictDoNothing();
          await tx.update(platformAnnouncementRecipients).set({deliveredAt:now})
            .where(and(eq(platformAnnouncementRecipients.announcementId,a.id),
              eq(platformAnnouncementRecipients.userId,recipient.userId)));
        }
        if(recipients.length<150){
          await tx.update(platformAnnouncements).set({status:"SENT",completedAt:now})
            .where(eq(platformAnnouncements.id,a.id));
        }
      });
    }
  }

  async deliveries(p:AdminPhase6Page){
    if(p.status)okType(p.status,["PENDING","FAILED","SENT","SKIPPED"]);
    if(p.kind)okType(p.kind,["IN_APP","PUSH"]);
    const where=and(p.status?eq(notificationDeliveries.status,p.status as "PENDING"|"FAILED"|"SENT"|"SKIPPED"):undefined,
      p.kind?eq(notificationDeliveries.channel,p.kind as "IN_APP"|"PUSH"):undefined);
    const [rows,totals,summary]=await Promise.all([
      this.db.select({notificationId:notificationDeliveries.notificationId,
        channel:notificationDeliveries.channel,status:notificationDeliveries.status,
        attempts:notificationDeliveries.attempts,lastAttemptAt:notificationDeliveries.lastAttemptAt,
        error:notificationDeliveries.error,userId:notifications.userId,
        title:notifications.title,createdAt:notifications.createdAt})
        .from(notificationDeliveries).innerJoin(notifications,eq(notifications.id,notificationDeliveries.notificationId))
        .where(where).orderBy(desc(notifications.createdAt))
        .limit(p.pageSize).offset(paging(p).offset),
      this.db.select({n:sql<number>`count(*)::int`}).from(notificationDeliveries).where(where),
      this.db.execute(sql`SELECT channel,status,count(*)::int total FROM notification_deliveries GROUP BY channel,status`),
    ]);
    return {...limitPage(rows,Number(totals[0]?.n??0),p),summary:summary.rows};
  }
  async requeuePush(actor:string,id:string,reason:string){
    const now=this.now();
    await this.db.transaction(async tx=>{
      const [d]=await tx.select().from(notificationDeliveries)
        .where(and(eq(notificationDeliveries.notificationId,id),eq(notificationDeliveries.channel,"PUSH")))
        .for("update").limit(1);
      if(!d)throw errors.badRequest("DELIVERY_NOT_FOUND","Push delivery not found.");
      if(d.status!=="FAILED"||d.attempts>=3)
        throw errors.conflict("RETRY_NOT_ALLOWED","Only failed push deliveries below three attempts can be requeued.");
      await tx.update(notificationDeliveries).set({status:"PENDING",error:null})
        .where(and(eq(notificationDeliveries.notificationId,id),eq(notificationDeliveries.channel,"PUSH")));
      await tx.insert(auditLogs).values({
        actorUserId:actor,action:"NOTIFICATION_DELIVERY_REQUEUED",
        targetType:"NOTIFICATION",targetId:id,metadata:{reason,attempts:d.attempts},createdAt:now,
      });
    });
    // Requeue is not proof of successful push delivery. A configured push worker
    // must actually process PENDING rows before they become SENT.
  }
}
