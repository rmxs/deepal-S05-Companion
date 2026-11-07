/* User preferences have direct menus; only technical configuration is Advanced. */
window.__DEEPAL_COMPANION_UI.mountAppSettings=(panel,stage,widget)=>{
  stage.innerHTML='<section class="app-settings-editor"></section>';
  widget.mode='app';
  widget._render();
  stage.querySelector('.app-settings-editor').append(widget);
};
window.__DEEPAL_COMPANION_UI.updateAppSettings=panel=>panel.updatePreviewNote?.();
