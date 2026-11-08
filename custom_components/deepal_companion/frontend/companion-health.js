/* Health page: a read-only list of checks. It never changes settings, charging data or notifications. */
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REFRESH_MS=30000;
const styles=`
.health{display:grid;gap:12px}
.health-summary{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.health-summary h2{margin:0;font-size:16px;flex:1;min-width:160px}
.health-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;font-size:13px;font-weight:600;color:rgb(var(--health-color));background:rgb(var(--health-color)/.14)}
.health-chip ha-icon{--mdc-icon-size:18px}
.health-ok{--health-color:52,211,153}.health-warning{--health-color:251,191,36}.health-error{--health-color:248,113,113}
.health-meta{font-size:12px;color:var(--secondary-text-color)}
.health-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.health-row{display:grid;grid-template-columns:32px minmax(0,1fr);gap:10px;align-items:start;padding:12px;border:1px solid var(--divider-color);border-radius:12px;background:var(--card-background-color);border-left:3px solid rgb(var(--health-color))}
.health-row ha-icon{--mdc-icon-size:22px;color:rgb(var(--health-color))}
.health-row strong{display:block;font-size:13px}.health-row p{margin:3px 0 0;font-size:12px;line-height:1.5;color:var(--secondary-text-color);overflow-wrap:anywhere}
.health-row .health-fix{color:var(--primary-text-color)}
.health-refresh{min-height:40px}
@media(max-width:760px){.health-list{grid-template-columns:minmax(0,1fr)}}
`;
const ICON={ok:'mdi:check-circle-outline',warning:'mdi:alert-outline',error:'mdi:alert-circle-outline'};
const TITLES={
  sensor_batt:['Battery level','Επίπεδο μπαταρίας','Nivel de batería'],sensor_ac:['AC charge current','Ρεύμα φόρτισης AC','Corriente de carga CA'],
  sensor_dc:['DC charge current','Ρεύμα φόρτισης DC','Corriente de carga CC'],sensor_odo:['Odometer','Οδόμετρο','Cuentakilómetros'],
  sensor_pow:['Power status','Κατάσταση ισχύος','Estado de energía'],sensor_fuel:['Fuel level','Στάθμη καυσίμου','Nivel de combustible'],
  sensor_charging:['Charging','Φόρτιση','Carga'],sensor_plug:['Charger plugged','Φορτιστής συνδεδεμένος','Cargador conectado'],
  sensor_tank:['Fuel tank capacity','Χωρητικότητα ντεπόζιτου','Capacidad del depósito'],sensor_cloud:['Cloud connection','Σύνδεση cloud','Conexión a la nube'],
  archive:['Charging recorder','Καταγραφή φόρτισης','Registro de carga'],schema:['Database','Βάση δεδομένων','Base de datos'],
  wal:['Database journal','Ημερολόγιο βάσης','Registro de la base de datos'],notifications:['Notifications','Ειδοποιήσεις','Notificaciones'],
  recipients:['Notification devices','Συσκευές ειδοποιήσεων','Dispositivos de notificación'],delivery:['Last notification','Τελευταία ειδοποίηση','Última notificación'],
  pricing:['Charging prices','Τιμές φόρτισης','Precios de carga']
};
export async function mountHealth(panel,stage){
  const t=(...args)=>panel.t(...args);
  const host=document.createElement('section');host.className='box health';
  host.innerHTML='<style>'+styles+'</style><div class="health-summary"><h2></h2><span class="health-chip"></span><button type="button" class="health-refresh"></button></div><p class="health-meta" role="status"></p><div class="health-list"></div>';
  stage.append(host);
  const q=selector=>host.querySelector(selector);
  let dead=false,busy=false,timer=null,owner={...panel.selected};
  q('h2').textContent=t('Health & Diagnostics','Υγεία & Διαγνωστικά','Estado y diagnóstico');
  q('.health-refresh').textContent=t('Check again','Έλεγχος ξανά','Comprobar de nuevo');
  function draw(result){
    const word={ok:t('All good','Όλα καλά','Todo bien'),warning:t('Needs attention','Θέλει προσοχή','Requiere atención'),error:t('Problem found','Βρέθηκε πρόβλημα','Problema detectado')};
    const chip=q('.health-chip');chip.className='health-chip health-'+result.status;chip.innerHTML='<ha-icon icon="'+ICON[result.status]+'" aria-hidden="true"></ha-icon>'+escape(word[result.status]);
    const c=result.counts||{};
    q('.health-meta').textContent=t('Checked ','Έλεγχος ','Comprobado ')+new Date(result.checked*1000).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})+' · '+(c.error||0)+' '+t('problems','προβλήματα','problemas')+', '+(c.warning||0)+' '+t('warnings','προειδοποιήσεις','avisos')+' · v'+escape(result.version);
    const list=q('.health-list');list.replaceChildren();
    for(const check of [...result.checks].sort((a,b)=>({error:0,warning:1,ok:2}[a.status]-{error:0,warning:1,ok:2}[b.status]))){
      const row=document.createElement('article');row.className='health-row health-'+check.status;
      const icon=document.createElement('ha-icon');icon.setAttribute('icon',ICON[check.status]||ICON.warning);icon.setAttribute('aria-hidden','true');
      const body=document.createElement('div'),title=document.createElement('strong');
      const names=TITLES[check.id];title.textContent=names?t(...names):check.title;body.append(title);
      if(check.detail){const p=document.createElement('p');p.textContent=check.detail;body.append(p);}
      if(check.fix&&check.status!=='ok'){const p=document.createElement('p');p.className='health-fix';p.textContent=check.fix;body.append(p);}
      row.append(icon,body);list.append(row);
    }
  }
  async function load(){
    if(dead||busy)return;busy=true;q('.health-refresh').disabled=true;
    try{
      const result=await panel.request('health_get',{},owner);
      if(!dead)draw(result);
    }catch(error){if(!dead)q('.health-meta').textContent=/Unknown Companion operation/i.test(error.message||'')?t('Restart Home Assistant to load the updated Companion backend.','Επανεκκίνησε το Home Assistant για να φορτώσει το νέο backend.','Reinicia Home Assistant para cargar el backend actualizado.'):(error.message||String(error));}
    finally{busy=false;if(!dead)q('.health-refresh').disabled=false;}
  }
  q('.health-refresh').onclick=load;
  await load();
  if(!dead)timer=setInterval(()=>{if(!document.hidden)load();},REFRESH_MS);
  return {busy:false,dirty:false,flush:async()=>{},destroy(){dead=true;clearInterval(timer);host.remove();}};
}
