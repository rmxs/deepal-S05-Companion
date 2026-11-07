/* A paged notification log. Removing log entries never changes alert latches. */
const styles=`
.design-history .activity-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0;border:0;flex-wrap:wrap;margin-bottom:12px}
.activity-heading h3{font-size:14px;font-weight:600;margin:0}.activity-heading>div{display:flex;align-items:center;gap:12px}.activity-count{font-size:12px;color:var(--design-muted)}
.design-root .activity-delete-all{color:rgb(var(--design-bad));border:1px solid rgb(var(--design-bad)/.25);background:rgb(var(--design-bad)/.06)}
.design-history .activity-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:0;border:0}
.activity-alert{position:relative;display:grid;grid-template-columns:36px minmax(0,1fr) 40px;gap:10px;align-items:start;min-width:0;overflow:hidden;background:var(--design-inner);border:1px solid var(--design-line);border-radius:16px;padding:14px 12px 12px 16px}
.activity-alert::before{content:'';position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:999px;background:rgb(var(--activity-color))}
.activity-icon{width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgb(var(--activity-color)/.15);color:rgb(var(--activity-color));flex:none}.activity-icon ha-icon{--mdc-icon-size:22px}
.activity-alert p{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}.activity-alert .activity-title{font-size:13px;font-weight:600;color:var(--design-fg);line-height:1.5}.activity-alert .activity-message{font-size:13px;line-height:1.5;color:var(--design-fg);margin-top:3px}
.activity-app{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:10px;color:var(--design-muted);margin-bottom:3px}.activity-app strong{font-weight:600;letter-spacing:.03em}.activity-app time{white-space:nowrap;font-size:11px}
.design-root .activity-delete{width:40px;min-width:40px;height:40px;padding:0;background:none;border:0;color:var(--design-muted)}.activity-delete:hover{color:rgb(var(--design-bad))}.activity-delete ha-icon{--mdc-icon-size:18px}
.activity-alert details{font-size:11px;color:var(--design-muted);margin-top:7px}.activity-alert summary{cursor:pointer;min-height:24px;line-height:24px}.activity-alert details p{font-size:11px;line-height:1.6;margin-top:3px}
.design-history .activity-footer{display:flex;align-items:center;justify-content:center;padding:12px 0 0;border:0;min-height:0}.activity-footer:empty{display:none}.activity-footer>div{min-height:40px}.activity-empty{grid-column:1/-1;padding:18px;border:1px dashed var(--design-line);border-radius:12px;text-align:center;color:var(--design-muted)}
.activity-confirm{margin-bottom:12px;padding:12px;border-radius:12px;background:rgb(var(--design-bad)/.06);border:1px solid rgb(var(--design-bad)/.25);display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px}.activity-confirm span{flex:1;min-width:200px}.activity-confirm button{min-width:100px}.activity-confirm .activity-confirm-delete{background:rgb(var(--design-bad));color:var(--design-accent-fg)}
@media(max-width:900px){.design-history .activity-list{grid-template-columns:minmax(0,1fr)}}
`;

export function mountActivity(host,request,UI,notify){
  let rows=[],total=0,hasMore=false,cursor=null,busy=false,dead=false,managed=true;
  host.innerHTML='<style>'+styles+'</style><div class="activity-heading"><h3>Recent activity</h3><div><span class="activity-count"></span><button class="activity-delete-all" type="button">Delete all</button></div></div><aside class="activity-confirm" hidden><span>Delete all notification activity? Alert settings and charging records will be kept.</span><button class="activity-confirm-cancel" type="button">Cancel</button><button class="activity-confirm-delete" type="button">Delete all</button></aside><div class="activity-list" aria-live="polite"></div><div class="activity-footer"></div>';
  const q=selector=>host.querySelector(selector),list=q('.activity-list'),footer=q('.activity-footer'),confirmation=q('.activity-confirm');
  const timeLabel=value=>{const age=Math.max(0,Date.now()/1000-value);if(age<60)return 'now';if(age<3600)return Math.floor(age/60)+' min ago';return new Date(value*1000).toLocaleDateString(undefined,{month:'short',day:'numeric'})+' · '+new Date(value*1000).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});};
  function set(page){managed=!page.readonly;rows=page.rows||[];total=page.total??rows.length;hasMore=!!page.has_more;cursor=page.next_before;draw();}
  function draw(){
    q('.activity-count').textContent=total?rows.length+' of '+total:'';q('.activity-delete-all').hidden=!total||!managed;q('.activity-delete-all').disabled=busy;list.replaceChildren();footer.replaceChildren();
    for(const item of rows){
      const card=document.createElement('article');card.className='activity-alert';card.dataset.activityId=item.id;card.style.setProperty('--activity-color','var(--design-'+(item.status==='error'?'bad':item.severity==='critical'?'bad':item.severity==='important'?'warn':'info')+')');
      const iconBox=document.createElement('div');iconBox.className='activity-icon';const icon=document.createElement('ha-icon');icon.setAttribute('icon',/^mdi:[a-z0-9-]+$/.test(item.icon||'')?item.icon:'mdi:bell-outline');iconBox.append(icon);
      const content=document.createElement('div'),app=document.createElement('div');app.className='activity-app';const brand=document.createElement('strong');brand.textContent='HOME ASSISTANT';const time=document.createElement('time');time.dateTime=new Date(item.time*1000).toISOString();time.title=new Date(item.time*1000).toLocaleString();time.textContent=timeLabel(item.time);app.append(brand,time);
      const title=document.createElement('p');title.className='activity-title';title.textContent=item.title||item.name||'Vehicle notification';const message=document.createElement('p');message.className='activity-message';message.textContent=item.message||item.error||'';
      const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=({test:'Test notification',test_ended:'Live test ended',sent:'Sent to Home Assistant',error:'Delivery issue',quiet_hours:'Skipped during quiet hours',dismissed:'Dismissed',locked:'Vehicle locked'})[item.status]||'Activity details';details.append(summary);
      for(const delivery of item.deliveries||[]){const line=document.createElement('p');line.textContent=delivery.device+' · '+(delivery.status==='accepted'?'Accepted by HA; phone delivery not confirmed':delivery.error||delivery.status);details.append(line);}
      content.append(app,title,message,details);const remove=document.createElement('button');remove.type='button';remove.className='activity-delete';remove.disabled=busy;remove.hidden=!managed;remove.setAttribute('aria-label','Delete this activity');const trash=document.createElement('ha-icon');trash.setAttribute('icon','mdi:delete-outline');remove.append(trash);remove.onclick=()=>perform('delete',item.id);card.append(iconBox,content,remove);list.append(card);
    }
    if(!rows.length){const empty=document.createElement('p');empty.className='activity-empty';empty.textContent='No notification activity yet.';list.append(empty);}
    if(!managed){const note=document.createElement('p');note.className='notification-info';note.textContent='Restart Home Assistant to enable activity deletion and Load more.';footer.append(note);}else if(busy){footer.innerHTML=UI.loaderHtml('sliders');footer.setAttribute('aria-label','Loading activity');}
    else if(hasMore){const more=document.createElement('button');more.type='button';more.dataset.activityMore='';more.textContent='Load more';more.onclick=()=>perform('more');footer.append(more);}
  }
  async function perform(action,id){
    if(busy||dead)return;busy=true;draw();
    try{
      if(action==='more'){const page=await request('notifications_history',{limit:5,before:cursor});if(dead)return;rows.push(...page.rows);total=page.total;hasMore=page.has_more;cursor=page.next_before;}
      else{const page=await request('notifications_history_delete',action==='all'?{all:true}:{id});if(dead)return;confirmation.hidden=true;if(action==='all')set(page);else{rows=rows.filter(item=>item.id!==id);total=page.total;if(!rows.length)rows=page.rows;hasMore=rows.length<total;cursor=hasMore?rows.at(-1)?.id:null;}notify(action==='all'?'Notification activity cleared.':'Activity deleted.');}
    }catch(error){if(!dead)notify(/Unknown.*operation/i.test(error.message||'')?'Restart Home Assistant to load activity management, then refresh.':error.message||'Could not update activity.',true);}
    finally{if(!dead){busy=false;draw();}}
  }
  q('.activity-delete-all').onclick=()=>{confirmation.hidden=false;};q('.activity-confirm-cancel').onclick=()=>{confirmation.hidden=true;};q('.activity-confirm-delete').onclick=()=>perform('all');
  return {set,destroy(){dead=true;}};
}
