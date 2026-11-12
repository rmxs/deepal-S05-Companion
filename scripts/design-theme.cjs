/* Theme the supplied dark designs. Tailwind writes colours such as bg-[#25282e] as rgb(37 40 46 / opacity), so the
 * hard-coded dark neutrals are replaced here with theme tokens (keeping any opacity). Dark themes stay close to the
 * original look; light themes get light surfaces. table: "r g b" -> {bg, line}. */
module.exports=function themeNeutrals(tree,table){
  const pattern=/rgb\((\d+) (\d+) (\d+)(?: \/ (var\([^)]*\)|[\d.]+%?))?\)/g;
  tree.walkDecls(decl=>{
    if(!/^(background|background-color|border|border-[a-z-]*color|outline-color)$/.test(decl.prop))return;
    const border=/border|outline/.test(decl.prop);
    decl.value=decl.value.replace(pattern,(match,r,g,b,alpha)=>{
      const rule=table[r+' '+g+' '+b];
      if(!rule)return match;
      const color=border?rule.line||rule.bg:rule.bg||rule.line;
      if(alpha===undefined)return color;
      const share=alpha.startsWith('var(')?'calc('+alpha+' * 100%)':alpha.endsWith('%')?alpha:Math.round(parseFloat(alpha)*1000)/10+'%';
      return 'color-mix(in srgb,'+color+' '+share+',transparent)';
    });
  });
};
