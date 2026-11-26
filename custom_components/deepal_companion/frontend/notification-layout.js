/* A shared scale for the supplied notification screens; behaviour stays in the adapter. */
export const notificationLayoutCss=`
.design-root .alert-row[data-enabled=true] .design-event-icon{color:var(--cp-accent)!important}

/* Live notification pages: section cards, option tiles, stepper cards, icon picker and test bar (colours come from the shared --cp tokens) */
.design-root .live-info p:first-child{color:var(--design-fg);font-weight:600}
.design-root .live-section{container-type:inline-size;display:flex;flex-direction:column;gap:14px;padding:16px!important;border-radius:20px}
.design-root .live-head{display:flex;align-items:center;gap:12px;min-width:0}
.design-root .live-hi{flex:none;--mdc-icon-size:20px;color:var(--cp-accent)}
.design-root .live-ht{flex:1;min-width:0}
.design-root .live-ht h3{margin:0;font-size:15px;font-weight:700;line-height:1.3;color:var(--design-fg)}
.design-root .live-ht p{margin:2px 0 0;font-size:12px;line-height:1.45;color:var(--design-muted)}
.design-root .live-count{flex:none;font-size:11.5px;font-weight:600;line-height:1;padding:7px 10px;border-radius:10px;color:var(--cp-accent);background:var(--cp-off-bg);border:1px solid var(--cp-off-line);white-space:nowrap}
.design-root .live-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.design-root .live-grid>.live-tile:last-child:nth-child(odd){grid-column:1/-1}
@container(max-width:520px){.design-root .live-grid{grid-template-columns:minmax(0,1fr)}}
.design-root .live-tile{position:relative;display:flex;align-items:center;gap:12px;min-width:0;min-height:68px;padding:12px 14px;box-sizing:border-box;border-radius:16px;border:1px solid var(--cp-off-line);background:var(--cp-off-bg);cursor:pointer;transition:background .18s,border-color .18s,transform .12s}
.design-root .live-tile:has(input:checked){background:var(--cp-on-bg);border-color:var(--cp-on-line)}
.design-root .live-tile:not(:has(input:checked)):hover{border-color:var(--design-muted)}

.design-root .live-tile:has(input:focus-visible){outline:2px solid rgb(var(--design-info,121 173 255));outline-offset:2px}
.design-root .live-tile:has(input:disabled){opacity:.45;cursor:default}
.design-root .live-sw{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.design-root .live-ic{flex:none;display:grid;place-items:center;width:40px;height:40px;border-radius:12px;--mdc-icon-size:22px;color:var(--design-muted);background:rgba(var(--rgb-primary-text-color,255,255,255),.06);transition:background .18s,color .18s}
.design-root .live-tile:has(input:checked) .live-ic{color:var(--cp-accent);background:color-mix(in srgb,var(--cp-accent) 20%,transparent)}
.design-root .live-tx{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:0!important;text-align:start}
.design-root .live-tt{display:flex;align-items:center;justify-content:flex-start;flex-wrap:wrap;gap:4px 8px;font-size:14px;font-weight:600;line-height:1.3;color:var(--design-fg)}
.design-root .live-td{font-size:12px;font-weight:400;line-height:1.4;color:var(--design-muted)}
.design-root .live-badge{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;line-height:1.2;padding:2px 7px;border-radius:7px;color:rgb(var(--design-warn,250 204 21));background:rgb(var(--design-warn,250 204 21)/.14)}
.design-root .live-tk{flex:none;position:relative;width:24px;height:24px;border-radius:50%;border:1.5px solid var(--cp-off-line);box-sizing:border-box;transition:background .18s,border-color .18s}
.design-root .live-tile:has(input:checked) .live-tk{background:var(--cp-accent);border-color:transparent}
.design-root .live-tile:has(input:checked) .live-tk::after{content:'';position:absolute;inset:0;background:var(--design-accent-fg,#0b1510);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M5.5 10.4l3 3 6-6.6' fill='none' stroke='%23000' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/100% no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M5.5 10.4l3 3 6-6.6' fill='none' stroke='%23000' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/100% no-repeat}
.design-root .compact-control-row.live-stepper.live-stepper{display:flex!important;flex-direction:column;align-items:stretch!important;justify-content:space-between;gap:12px!important;padding:14px!important;min-height:0;box-sizing:border-box;border-radius:16px;border:1px solid var(--cp-off-line);background:var(--cp-off-bg)}
.design-root .compact-control-row.live-stepper.live-stepper>.live-tx{align-self:stretch}.design-root .compact-control-row.live-stepper>div:last-child{width:100%;box-sizing:border-box}
.design-root .live-iconrow{display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px;align-items:center}
.design-root .live-prev{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;--mdc-icon-size:24px;color:var(--cp-accent);background:var(--cp-on-bg);border:1px solid var(--cp-on-line)}
.design-root .live-presets{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.design-root .live-presets-l{font-size:12px;color:var(--design-muted);margin-right:2px}
.design-root button.live-chip{height:36px;min-height:36px;padding:0 12px;gap:8px;border-radius:12px;font-size:12px;font-weight:600;border:1px solid var(--cp-off-line);background:var(--cp-off-bg);color:var(--design-fg);--mdc-icon-size:18px;transition:background .18s,border-color .18s}

.design-root .live-actions{display:flex;flex-wrap:wrap;gap:10px}
.design-root button.live-btn{height:44px;min-height:44px;padding:0 18px;gap:8px;border-radius:14px;font-size:13.5px;font-weight:700;border:1px solid var(--cp-off-line);background:var(--cp-off-bg);color:var(--design-fg);--mdc-icon-size:20px;transition:transform .12s,opacity .18s}

.design-root button.live-btn:disabled{opacity:.45;cursor:default}
.design-root button.live-btn-primary{flex:1 1 150px;background:var(--cp-accent);border-color:transparent;color:var(--design-accent-fg,#0b1510)}
@media(max-width:480px){.design-root .live-section{padding:14px!important}.design-root button.live-btn{flex:1 1 0}}
.design-root .compact-control-row.compact-control-row{align-items:center!important}.design-root .compact-control-row.compact-control-row>span{align-self:center}.design-root .compact-control-row.compact-control-row>div:last-child:has(input[type=number]){height:44px;box-sizing:border-box;padding:3px;gap:0!important;align-items:center!important;border-radius:13px;border:1px solid var(--cp-off-line);background:var(--cp-off-bg)}.design-root .compact-control-row.compact-control-row>div:last-child:has(input[type=number]) button{width:36px!important;min-width:36px!important;height:36px!important;min-height:36px!important;border:0!important;border-radius:10px!important;background:transparent!important;font-size:18px;display:grid!important;place-items:center!important;line-height:1!important;padding:0!important;color:var(--design-fg)!important}.design-root .compact-control-row.compact-control-row>div:last-child:has(input[type=number]) button:hover{background:var(--cp-on-bg)!important;color:var(--cp-accent)!important}.design-root .compact-control-row.compact-control-row>div:last-child>div:has(input[type=number]){display:flex!important;align-items:center!important;height:36px;justify-content:center;gap:3px;min-width:0}.design-root .compact-control-row.compact-control-row input[type=number]{width:auto!important;max-width:46px;min-width:22px;height:36px!important;line-height:36px!important;padding:0!important;margin:0!important;border:0!important;background:transparent!important;box-shadow:none!important;font-size:15px!important;font-weight:700!important;color:var(--design-fg)!important;-webkit-text-fill-color:var(--design-fg)!important;opacity:1!important;-moz-appearance:textfield}.design-root .compact-control-row.compact-control-row input[type=number]::-webkit-inner-spin-button,.design-root .compact-control-row.compact-control-row input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.design-root .compact-control-row.compact-control-row input[type=number]+span{width:auto!important;min-width:0!important;font-size:11px!important;color:var(--design-muted)} .design-root .compact-control-row.compact-control-row>div:last-child:has(input[type=number])>button{font-size:0!important}.design-root .compact-control-row.compact-control-row>div:last-child:has(input[type=number])>button:first-child::before{content:'−';font-size:20px;font-weight:600;line-height:1;display:block;transform:translateY(1px)}.design-root .compact-control-row.compact-control-row>div:last-child:has(input[type=number])>button:last-child::before{content:'+';font-size:20px;font-weight:600;line-height:1;display:block;transform:translateY(1px)}/* one pill: − value unit +, all the same height *//* Device picker: equal tiles in a grid, same on/off look as every other tile (tokens from companion-panel.css) */.design-root :has(>.device-pill){display:grid!important;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px!important}.design-root .device-pill{display:flex!important;align-items:center!important;gap:10px!important;min-height:var(--cp-ctl-h);padding:8px 12px!important;border-radius:999px!important;border:1px solid var(--cp-off-line)!important;background:var(--cp-off-bg)!important;color:var(--design-fg)!important;font-weight:600!important;box-shadow:none!important;text-align:left;min-width:0}.design-root .device-pill span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px!important}.design-root .device-pill.active{background:var(--cp-on-bg)!important;border-color:var(--cp-on-line)!important;color:var(--cp-accent)!important}.design-root .device-pill .fa-check{order:9;margin-left:auto}.design-root .device-pill *{color:var(--design-muted)!important;opacity:1!important}.design-root .device-pill span{color:var(--design-fg)!important}.design-root .device-pill.active *,.design-root .device-pill.active span{color:var(--cp-accent)!important}@media(max-width:480px){.design-root :has(>.device-pill){grid-template-columns:repeat(2,minmax(0,1fr))}}.design-root .alert-row[data-enabled=true]{background:var(--cp-on-bg)!important;border-color:var(--cp-on-line)!important}
.design-root .alert-row[data-enabled=false]{opacity:1;filter:none;background:var(--cp-off-bg)!important}
.design-root .alert-row[data-enabled=false]>div:first-child{opacity:.6;filter:grayscale(1)}
.design-root button:is(.bg-emerald-400,.device-pill.active,.preset-btn.active){border:1px solid transparent!important;border-radius:var(--nf-radius)!important;box-shadow:0 2px 5px #0002;font-weight:600}
.design-root .ha-card{padding:var(--cp-block-p)}
.design-root .live-tag{margin-left:8px;font-size:9px;font-weight:700;letter-spacing:.06em;padding:1px 6px;border-radius:999px;vertical-align:middle}
/* segmented choices: 36 px options inside a 44 px group, like every other segmented control */
.design-root{--nf-field:44px;--nf-action:var(--cp-ctl-h,40px);--nf-radius:var(--cp-ctl-r,12px);--nf-gap:12px;font-size:13px;line-height:1.5}
.design-root button{box-sizing:border-box;height:var(--nf-action);min-height:var(--nf-action);padding:8px 12px;border-radius:var(--nf-radius);font-size:13px;line-height:20px;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:normal}
/* Segmented choices (quiet mode, filter presets) keep the Settings .seg button size, not the design button size above. */
.design-root .seg>button{height:auto;min-height:0;padding:7px 6px;border-radius:11px;font-size:12.5px;line-height:inherit}
.design-root input:not([type=checkbox]),.design-root select{box-sizing:border-box;height:var(--nf-field);min-height:var(--nf-field);max-height:var(--nf-field);font-size:16px;line-height:20px;padding:10px 12px;border-radius:var(--nf-radius);font-weight:400}
.design-root input[type=number]{font-variant-numeric:tabular-nums;text-align:center;font-weight:600}
.design-root label:has(>input.peer){width:44px;min-width:44px;height:44px;min-height:44px;padding:0;flex:none}
.design-root .design-save-actions{display:flex;flex-wrap:nowrap;gap:8px;margin:0;position:relative}
.design-root .design-save-actions button,.design-root [data-command=reset],.design-root [data-command=test]{height:40px;min-height:40px;min-width:108px;padding:8px 12px;border-radius:10px;font-size:13px;white-space:nowrap}
.design-root .design-status{position:absolute;right:0;bottom:calc(100% + 8px);height:28px;min-height:28px;width:max-content;max-width:220px;line-height:18px;padding:4px 10px;font-size:12px;border-radius:999px;z-index:6;box-shadow:0 4px 16px #0002}
.design-root .design-status.saved{display:none}
.design-root .design-controlbar{position:static;padding:16px;gap:16px}
.design-root .design-header-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#master-status-badge,#master-action-label,.notification-internal-tabs{display:none!important}
.notification-page-heading{font-size:14px!important;text-transform:none!important;letter-spacing:normal!important}
.notification-matrix{display:flex;flex-direction:column;gap:20px;padding:16px}
.notification-matrix>div{margin:0!important}.notification-category{display:flex;flex-direction:column;gap:10px}
.notification-category .design-category-heading{font-size:13px;letter-spacing:0;margin:0}
.notification-alert-grid{display:grid;grid-template-columns:1fr;gap:10px}
.notification-alert-grid>.alert-row{margin:0!important;width:100%;min-width:0;min-height:96px;padding:12px;border-radius:14px;gap:10px;align-items:center;box-sizing:border-box}
.notification-alert-grid .alert-row>div:first-child{gap:10px;align-items:center}.notification-alert-grid .alert-row>div:last-child{gap:4px;flex:none}
.notification-alert-grid .design-event-emblem{width:36px;height:36px;min-width:36px;border-radius:10px}
.notification-alert-grid .alert-row h4{font-size:13px;line-height:1.4}.notification-alert-grid .alert-row p{font-size:12px;line-height:1.5;margin-top:3px}
.notification-alert-grid .alert-row>div:last-child>button{width:32px;min-width:32px;height:40px;padding:0;background:transparent;border:0}
@media(min-width:900px){.notification-alert-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.notification-alert-grid>.alert-row{grid-column:span 2}.notification-alert-grid>.alert-row:last-child:nth-child(odd):not(:first-child){grid-column:2/span 2}}
@media(min-width:1400px){.notification-alert-grid{grid-template-columns:repeat(6,minmax(0,1fr))}.notification-alert-grid>.alert-row,.notification-alert-grid>.alert-row:last-child:nth-child(odd):not(:first-child){grid-column:span 2}.notification-alert-grid>.alert-row:nth-last-child(2):nth-child(3n+1),.notification-alert-grid>.alert-row:last-child:nth-child(3n+2):not(:first-child){grid-column:span 3}.notification-alert-grid>.alert-row:last-child:nth-child(3n+1):not(:first-child){grid-column:3/span 2}}
#main-card>div:first-child{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:16px}
#main-card>div:first-child>div:first-child{flex:1;min-width:220px;gap:10px}
#main-card .design-header-actions{display:flex;width:auto;margin:0;flex-wrap:wrap;justify-content:flex-start;gap:8px}
.design-alert-switch{display:flex;align-items:center;gap:8px;background:none!important;border:0!important;border-radius:0!important;padding:0!important;min-height:40px;order:-1}
.design-alert-switch>span{font-size:13px!important}#status-label{min-width:94px;font-size:12px}#status-icon-box{width:36px;height:36px;min-width:36px}
#main-card [data-command=test]{font-size:13px}#main-card button[aria-label='Back to overview']{width:40px;min-width:40px;padding:0}
#card-body{padding:16px}.notification-editor-grid{display:grid!important;grid-template-columns:minmax(340px,.85fr) minmax(0,1.5fr)!important;gap:16px;align-items:start}
.notification-editor-grid>.design-editor-section{grid-column:auto!important;display:flex;flex-direction:column;justify-content:flex-start!important;gap:16px;padding:16px;min-width:0;max-width:100%}
.notification-editor-grid>.design-editor-section>*{margin:0!important}.notification-editor-grid .notification-section-heading{font-size:13px;line-height:20px;letter-spacing:0;text-transform:none;color:rgb(var(--section-color))!important}
.notification-composer{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.notification-delivery-options{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
.notification-delivery-options label,.notification-composer label{font-size:12px;line-height:18px;margin-bottom:6px}
#sev-feedback{padding:0;border:0;background:none;font-size:12px;line-height:1.5}
.notification-severity{display:flex;flex-direction:column;gap:8px}.notification-severity>div{margin:0!important}
.notification-icon-field{display:flex;flex-direction:column;gap:6px;min-width:0}.notification-icon-field>label{margin:0}.notification-icon-field>label>span:last-child{display:none}
.notification-icon-field>div{padding:0;border:0;background:transparent;box-shadow:none}
.design-icon-picker{display:block;width:100%;min-width:0;height:44px;min-height:44px;--ha-select-height:44px;--mdc-text-field-fill-color:var(--design-inner);--mdc-text-field-label-ink-color:var(--design-muted);--ha-color-form-background:var(--design-inner)}
.notification-composer .notification-variables{display:flex;flex-direction:column;gap:6px}.notification-variables>span{font-size:12px}
.design-root #design-variables{display:flex;flex-wrap:wrap;gap:6px}.design-root #design-variables button{height:32px;min-height:32px;padding:4px 10px;border-radius:999px;font-size:12px}
.notification-composer .notification-text-fields{display:flex;flex-direction:column;gap:12px}.notification-text-fields>div{margin:0!important}
.notification-composer .notification-preview{padding:0}.notification-preview>div:first-child{font-size:12px;letter-spacing:0;text-transform:none}.notification-preview #preview-title{white-space:normal;overflow-wrap:anywhere;font-size:13px}.notification-preview #preview-body{font-size:13px;line-height:1.5;-webkit-line-clamp:unset}
.compact-control-row{display:grid!important;grid-template-columns:minmax(0,1fr) 168px;gap:12px;align-items:center;padding:8px!important;min-height:60px}
.compact-control-row[style*="display: none"]{display:none!important}
.compact-control-row>span{font-size:13px!important;line-height:1.4;padding:0!important}.compact-control-row>div:last-child{display:grid!important;grid-template-columns:36px minmax(0,1fr) 36px;gap:4px!important;width:168px}
.compact-control-row:has(input[type=checkbox])>div:last-child{display:flex!important;justify-content:flex-end}
.design-root .compact-control-row button{width:36px;min-width:36px;height:40px;min-height:40px;padding:0;border-radius:10px}
.compact-control-row>div:last-child>div:has(input[type=number]){display:grid;grid-template-columns:54px 30px;gap:4px;align-items:center}
.compact-control-row input[type=number]{width:54px!important;height:44px!important;padding:10px 4px!important}.compact-control-row input[type=number]+span{width:30px;min-width:30px;margin:0!important;padding:0!important;text-align:left;font-size:11px!important;white-space:nowrap}
#design-action-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#design-action-options button,.design-root .sev-btn{height:40px;min-height:40px;font-size:12px}
.notification-timing>div:has(#schedule-desc){font-size:12px;padding:10px}#schedule-desc{font-size:12px;line-height:1.5}
#quiet-inputs-box{display:grid!important;grid-template-columns:minmax(0,1fr) 16px minmax(0,1fr);gap:8px;padding:0;border:0;background:none}
#quiet-inputs-box>div{display:flex;flex-wrap:nowrap;padding:0 10px;gap:8px;height:44px;border-radius:10px}
#quiet-inputs-box input{height:44px;min-height:44px;font-size:16px;font-weight:500;padding:0;background:none}#quiet-inputs-box>div>span{display:inline!important;font-size:12px!important}
.notification-info{display:flex;align-items:flex-start;gap:10px;border:1px solid rgb(var(--design-info,121 173 255)/.2);border-radius:12px;background:rgb(var(--design-info,121 173 255)/.06);padding:12px;color:var(--design-muted);font-size:12px;line-height:1.6}
.notification-info ha-icon{flex:none;--mdc-icon-size:18px;color:rgb(var(--design-info,121 173 255));margin-top:2px}.notification-info p{margin:0}.notification-info p+p{margin-top:6px}
@media(max-width:1050px){.notification-editor-grid{grid-template-columns:minmax(0,1fr)!important}.notification-delivery-options{grid-template-columns:repeat(2,minmax(0,1fr))}#main-card .design-header-actions{width:100%}}
@media(max-width:640px){.design-root .design-controlbar{padding:12px}.design-controlbar .design-header-actions{width:100%;justify-content:flex-start}#main-card>div:first-child{padding:12px}#card-body{padding:12px}.notification-editor-grid>.design-editor-section{padding:12px}.notification-delivery-options{grid-template-columns:minmax(0,1fr)}.design-root .design-save-actions{display:flex;grid-column:auto}.design-root .design-save-actions button,#main-card [data-command=reset],#main-card [data-command=test]{min-width:100px;flex:1}#main-card .design-header-actions{display:flex;gap:8px}#main-card .design-header-actions>div:has(#master-toggle){order:-1;width:100%}#main-card [data-command=reset],#main-card [data-command=test]{order:0;grid-column:auto}.compact-control-row{grid-template-columns:minmax(0,1fr) 168px;gap:6px}.notification-alert-grid>.alert-row{min-height:96px}#quiet-inputs-box{grid-template-columns:minmax(0,1fr) 12px minmax(0,1fr)}#quiet-inputs-box>div{width:auto;min-width:0;padding:0 6px}#quiet-inputs-box>span{display:block!important}#quiet-inputs-box>div>span{display:none!important}.notification-matrix{padding:12px}}
@media(max-width:640px){#main-card>div:first-child{position:relative}#main-card>div:first-child>div:first-child{padding-right:44px}#main-card .design-header-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}#main-card .design-header-actions>.design-alert-switch{position:absolute;right:12px;top:12px;width:44px!important;min-height:44px}#main-card .design-alert-switch>span{display:none}#main-card .design-save-actions{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;order:0;width:100%}#main-card [data-command=reset]{order:1}#main-card [data-command=test]{order:2}.design-root .design-status{position:fixed;top:88px;right:16px;bottom:auto}}
`;

// Only the native field surface is sized; HA retains its icon list, search and mobile picker.
export async function compactIconPicker(picker){
  const visit=async(node,depth=0)=>{
    if(depth>9||!picker.isConnected)return;
    await node.updateComplete;
    const shadow=node.shadowRoot;if(!shadow)return;
    if(['HA-PICKER-FIELD','HA-TEXTFIELD','HA-COMBO-BOX','HA-SELECT'].includes(node.tagName)&&!shadow.querySelector('[data-notification-field-size]')){
      const style=document.createElement('style');style.dataset.notificationFieldSize='';
      style.textContent='.field,.mdc-text-field{box-sizing:border-box;height:44px!important;min-height:44px!important;max-height:44px!important;border:1px solid var(--design-line)!important;border-radius:10px!important;background:var(--design-inner)!important}ha-combo-box-item{--ha-combo-box-item-min-height:44px!important;--ha-combo-box-item-two-line-min-height:44px!important}.field:after{display:none}.trigger{min-height:42px!important}input{font-family:var(--notification-font)!important;font-size:16px!important}.mdc-floating-label{display:none}.mdc-text-field__input{padding-top:0!important}.mdc-text-field__ripple{border-radius:10px!important}';shadow.append(style);
    }
    await Promise.all([...shadow.querySelectorAll('ha-selector-icon,ha-icon-picker,ha-generic-picker,ha-picker-field,ha-combo-box,ha-textfield,ha-select')].map(el=>visit(el,depth+1)));
  };
  await visit(picker);
}

export function arrangeNotifications(root){
  const q=s=>root.querySelector(s),qa=s=>[...root.querySelectorAll(s)];
  q('#tab-overview').parentElement.classList.add('notification-internal-tabs');
  q('.font-bold.tracking-wide.uppercase').classList.add('notification-page-heading');
  q('#master-status-badge').hidden=true;q('#master-action-label').hidden=true;
  q('.design-controlbar h2').textContent=window.__DEEPAL_COMPANION_UI?.t?window.__DEEPAL_COMPANION_UI.t('Master switch'):'Master switch';
  const matrix=q('.alert-row').parentElement.parentElement.parentElement;matrix.classList.add('notification-matrix');
  for(const row of qa('.alert-row')){row.parentElement.classList.add('notification-alert-grid');row.parentElement.parentElement.classList.add('notification-category');}
  const master=q('#master-panel-toggle');master.setAttribute('aria-label','Enable notifications');
  const alert=q('#master-toggle');alert.setAttribute('aria-label','Enable this alert');const alertSwitch=alert.closest('label').parentElement;alertSwitch.classList.add('design-alert-switch');alertSwitch.querySelector('span').textContent='Alert enabled';
  const grid=q('#card-body>.grid'),[timing,priority,message]=grid.children;grid.className='notification-editor-grid';timing.classList.add('notification-timing');
  for(const node of [timing,priority,message]){node.classList.remove('justify-between');node.firstElementChild.querySelector('span').classList.add('notification-section-heading');node.firstElementChild.lastElementChild.remove();}
  timing.firstElementChild.querySelector('span').lastChild.textContent=' Timing & conditions';
  message.firstElementChild.querySelector('span').lastChild.textContent=' Notification & preview';
  const severity=priority.children[1],feedback=q('#sev-feedback'),icon=priority.children[3];
  const options=document.createElement('div');options.className='notification-delivery-options';const severityGroup=document.createElement('div');severityGroup.className='notification-severity';severityGroup.append(severity,feedback);icon.classList.add('notification-icon-field');icon.querySelector('label>span').textContent='Notification icon';options.append(severityGroup,icon);
  message.children[1].classList.add('notification-variables');message.children[1].firstElementChild.textContent='Insert car value';message.children[2].classList.add('notification-text-fields');message.children[3].classList.add('notification-preview');
  message.classList.add('notification-composer');message.firstElementChild.after(options);priority.remove();
  for(const label of message.querySelectorAll('.notification-text-fields label'))label.textContent=label.textContent.includes('Title')?'Title':'Message';
  q('#card-body').lastElementChild.remove(); // Header already has a Back control.
  for(const input of qa('input[type=number]'))input.closest('.flex.items-center.justify-between')?.classList.add('compact-control-row');
  for(const button of qa('[data-command=save]'))button.textContent='Save';for(const button of qa('[data-command=test]'))button.textContent='Test notification';
  const picker=q('[data-notification-icon]');picker.label='';picker.required=false;picker.setAttribute('aria-label','Notification icon');compactIconPicker(picker);
}

export const compactNotificationCss=`
:host{touch-action:pan-y pinch-zoom}.notification-matrix{container-type:inline-size;padding:10px;gap:12px}.notification-category{gap:8px}.notification-matrix .notification-alert-grid{grid-template-columns:minmax(0,1fr);gap:8px}.notification-matrix .notification-alert-grid>.alert-row{grid-column:auto!important;min-height:74px;padding:8px 10px;border-radius:var(--cp-item-r)}.notification-alert-grid .design-event-emblem{width:30px;height:30px;min-width:30px;border-radius:8px}.notification-alert-grid .design-event-icon ha-icon{--mdc-icon-size:18px}.notification-alert-grid .alert-row p{font-size:11px;line-height:1.4}.notification-matrix>div:first-child{padding-bottom:10px}.notification-matrix>div:first-child p{font-size:12px}
@container(min-width:660px){.notification-matrix .notification-alert-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container(min-width:1060px){.notification-matrix .notification-alert-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.notification-info{padding:10px;gap:8px;line-height:1.5}
`;

export const notificationTitleCss=`.notification-title-bar{min-height:36px;gap:8px}.notification-title-bar>div:first-child{min-width:0;flex:1}.notification-title-bar .notification-page-heading{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.notification-title-row{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;flex:none;min-height:36px}.notification-title-row>.notification-title-status{position:static!important;inset:auto!important;margin-left:auto;display:inline-flex;align-items:center;justify-content:center;width:150px;max-width:150px;height:28px;min-height:28px;flex:none;align-self:center;box-shadow:none;white-space:nowrap}.notification-title-row>.notification-title-status+div{flex:none}.notification-title-row .notification-title-status.saved{display:inline-flex!important;visibility:hidden;pointer-events:none}@media(max-width:640px){.notification-title-row{gap:6px}.notification-title-row>.notification-title-status{font-size:11px;padding:4px 8px;width:128px;max-width:128px}}`;
