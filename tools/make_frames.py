# Generates the reusable card frame overlays (assets/frame_<type>.svg). The card art is a separate <img> layer
# under the frame, so frames and illustrations are never baked together.
# Frame colour = card's main effect: attack red, defense blue, buff green, debuff purple, utility gold, curse black.
PAL = {  # light, mid, dark, trim
  'attack':  ('#ff9a7a', '#b3261a', '#3a0604', '#f3c35a'),
  'defense': ('#a8dcff', '#2a6cc0', '#06183a', '#e6d08a'),
  'buff':    ('#b8f59a', '#2f9a44', '#082a10', '#efd27a'),
  'debuff':  ('#e2b2ff', '#7a36b8', '#1c0636', '#e8c86e'),
  'utility': ('#fff1b0', '#c0901e', '#3a2604', '#fff3c4'),
  'curse':   ('#9aa08a', '#2c2e28', '#050505', '#8fb04a'),
}
W, H = 300, 420
def frame(t):
    l, m, d, g = PAL[t]
    outer = f'M18 0H{W-18}Q{W} 0 {W} 18V{H-18}Q{W} {H} {W-18} {H}H18Q0 {H} 0 {H-18}V18Q0 0 18 0Z'
    inner = f'M24 13H{W-24}Q{W-13} 13 {W-13} 24V{H-24}Q{W-13} {H-13} {W-24} {H-13}H24Q13 {H-13} 13 {H-24}V24Q13 13 24 13Z'
    corner = lambda x, y, sx, sy: (f'<g transform="translate({x} {y}) scale({sx} {sy})">'
        f'<path d="M0 0L30 0Q16 4 10 10Q4 16 0 30Z" fill="url(#metal)" stroke="{d}" stroke-width="1.2"/>'
        f'<path d="M6 6L22 6Q12 10 6 22Z" fill="{g}" opacity=".85"/><circle cx="8" cy="8" r="3.2" fill="{l}" stroke="{d}"/></g>')
    banner = (f'<path d="M62 16H238L250 35L238 54H62L50 35Z" fill="url(#bannerg)" stroke="{g}" stroke-width="2"/>'
              f'<path d="M66 20H234L243 35L234 50H66L57 35Z" fill="none" stroke="{l}" stroke-opacity=".45" stroke-width="1"/>')
    plate = (f'<path d="M84 222H216L228 233L216 244H84L72 233Z" fill="{d}" stroke="{g}" stroke-width="1.6"/>'
             f'<path d="M60 233L72 228V238Z M240 233L228 228V238Z" fill="{g}"/>')
    panel = (f'<rect x="20" y="248" width="260" height="150" rx="9" fill="url(#panelg)" stroke="{g}" stroke-opacity=".75" stroke-width="1.4"/>'
             f'<rect x="24" y="252" width="252" height="142" rx="7" fill="none" stroke="{l}" stroke-opacity=".18"/>')
    sockets = (f'<circle cx="34" cy="34" r="27" fill="url(#metal)" stroke="{d}" stroke-width="2"/><circle cx="34" cy="34" r="22" fill="{d}"/>'
               f'<circle cx="266" cy="34" r="19" fill="url(#metal)" stroke="{d}" stroke-width="2"/><circle cx="266" cy="34" r="15" fill="{d}"/>')
    curse_extra = ''
    if t == 'curse':  # thorny vines on the frame
        curse_extra = ''.join(f'<path d="M{x} {y}l6 -5l-2 7z" fill="{g}"/>' for x, y in [(8,120),(8,200),(8,300),(286,140),(286,240),(286,330),(120,410),(200,410)])
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">
<defs>
<linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{l}"/><stop offset=".22" stop-color="{m}"/><stop offset=".5" stop-color="{d}"/><stop offset=".72" stop-color="{m}"/><stop offset="1" stop-color="{l}"/></linearGradient>
<linearGradient id="bannerg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{m}"/><stop offset="1" stop-color="{d}"/></linearGradient>
<linearGradient id="panelg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0810" stop-opacity=".66"/><stop offset="1" stop-color="#050307" stop-opacity=".86"/></linearGradient>
</defs>
<path d="{outer} {inner}" fill-rule="evenodd" fill="url(#metal)"/>
<path d="{outer}" fill="none" stroke="#000" stroke-opacity=".7" stroke-width="2"/>
<path d="{inner}" fill="none" stroke="{g}" stroke-width="2"/>
<path d="M27 19H{W-27}Q{W-19} 19 {W-19} 27V{H-27}Q{W-19} {H-19} {W-27} {H-19}H27Q19 {H-19} 19 {H-27}V27Q19 19 27 19Z" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="2"/>
{corner(4,4,1,1)}{corner(W-4,4,-1,1)}{corner(4,H-4,1,-1)}{corner(W-4,H-4,-1,-1)}
{curse_extra}{panel}{plate}{banner}{sockets}
</svg>'''
for t in PAL:
    open(f'/workspace/dnd-spire/assets/frame_{t}.svg', 'w').write(frame(t))
print('ok')
