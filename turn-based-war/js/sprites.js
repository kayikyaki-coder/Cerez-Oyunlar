// sprites.js — 16x16 pixel-art sprite'lar ve çizim yardımcıları
// '.' = saydam. Her harf bir renge eşlenir (pal). Tüm sprite'lar SAĞA bakar;
// düşmanlar drawSpriteGrid(..., flip=true) ile sola çevrilir.
// Her sprite'ın frames[0] (ana kare) ve frames[1] (idle, 2. kare) vardır.
// Ortak kurallar: dış hat "o" (#15111a), zemin satırı (15) mümkünse boş, gölge render'da.

const SPR_OUTLINE = "#15111a";

const Sprites = {
  // =============== KAHRAMANLAR ===============
  fighter: {
    pal: { ".": null, "o": SPR_OUTLINE, "a": "#b8c2d0", "A": "#6b7583", "d": "#414a56", "s": "#f0b98c", "n": "#3a2418",
           "r": "#d43a3a", "R": "#8e2424", "m": "#eef3f8", "y": "#e5b640", "b": "#3f78c8", "B": "#274d86", "w": "#f3f6fa" },
    grid: [
      ".......rrr......",
      "......orRro.....",
      ".....oaaaaao.omo",
      "....oaAAAAAaoomo",
      "....oaossssaoomo",
      "....oaonssnaoomo",
      ".....oassso..omo",
      "....ooAaAoo..omo",
      "..obbAaaaAAooyyy",
      ".obBwbAaaAAAasyo",
      ".obwwbAaaAAAo.yo",
      ".obBwbAAaAAAo.o.",
      "..obboAAAAAo....",
      "....odAoAdo.....",
      "....odo.odo.....",
      "....oo...oo....."
    ]
  },
  cleric: {
    pal: { ".": null, "o": SPR_OUTLINE, "b": "#4a86d6", "B": "#2f5b9c", "d": "#213f6e", "s": "#f0b98c", "n": "#3a2418",
           "w": "#f4f4fa", "g": "#c9d3e0", "y": "#e5b640", "Y": "#a67c1e", "h": "#6b3e1e", "m": "#9ea4b0", "M": "#5e6470" },
    grid: [
      "......oooo......",
      ".....obbbbo.....",
      "....obBhhhBo....",
      "....obossssbo...",
      "....obonssnbooo.",
      ".....oossso.ommo",
      "....ooBbbBoooMmo",
      "...obbbwbbbooMmo",
      "..obBbwwwbBbbho.",
      "..obbbbwbbbo.ho.",
      "..obBbbbbbBo.ho.",
      "..obbbbybbbo.ho.",
      "..obBbbbbbBo.oo.",
      "..obbbbbbbbo....",
      "...oddoodddo....",
      "...oooo.oooo...."
    ]
  },
  wizard: {
    pal: { ".": null, "o": SPR_OUTLINE, "h": "#5a3aa0", "H": "#3b2470", "p": "#7f5bd0", "P": "#5a3aa0", "y": "#f5d23e",
           "s": "#f0b98c", "n": "#3a2418", "w": "#ece9f5", "g": "#b9b3d1", "c": "#66e0ff", "C": "#2aa5d8", "t": "#8b5a2b" },
    grid: [
      ".......y........",
      "......oho.......",
      "......ohho......",
      ".....ohHho......",
      ".....ohhhho.....",
      "....ohHhhhho..oc",
      "...ohhhhhhhho.cC",
      "..oooooooooooooc",
      "....ossssso...ot",
      "....onssnwo...ot",
      "....osswwwoppsot",
      "...opPwwwpo...ot",
      "...oppwwppo...ot",
      "..opPpwppPpo..ot",
      "..oppppppppo..ot",
      "..oooooooooo...."
    ]
  },

  // =============== HAYVANLAR / CANAVARLAR ===============
  wolf: {
    pal: { ".": null, "o": SPR_OUTLINE, "f": "#9aa0a8", "F": "#646a73", "d": "#454a52", "e": "#ffd23f", "t": "#f2f4f6", "n": "#2a2530", "p": "#d88a9a" },
    grid: [
      "...........o..o.",
      "..........ofoofo",
      ".oo.......offffo",
      "oFfooooooofffFeo",
      "oFfoffffffffffno",
      ".oFfffffffffFoto",
      "..oFFffffffffoo.",
      "..oFFFFFFffffo..",
      "...oFFoFFFFFo...",
      "...oFo.oFooFo...",
      "...oFo.oFo.oFo..",
      "...oo..oo..oo...",
      "................",
      "................",
      "................",
      "................"
    ]
  },
  direwolf_alpha: {
    pal: { ".": null, "o": SPR_OUTLINE, "f": "#5b5563", "F": "#3a3540", "d": "#25222b", "e": "#ff4a3a", "E": "#ffb3a0", "t": "#f2f4f6", "n": "#120f16", "r": "#c93a4a", "x": "#8d8798" },
    grid: [
      "...........o..o.",
      "..........ofoofo",
      ".oo..x.x..offffo",
      "oFfoxxxxxxfffreo",
      "oFfoffffffffffno",
      ".oFfffffffffFoto",
      "..oFFffffffffoo.",
      "..oFFFFFFffffo..",
      "...oFFoFFFFFo...",
      "...oFo.oFooFo...",
      "...oFo.oFo.oFo..",
      "...oo..oo..oo...",
      "................",
      "................",
      "................",
      "................"
    ]
  },
  spider: {
    pal: { ".": null, "o": SPR_OUTLINE, "b": "#4a2f63", "B": "#2c1a3d", "e": "#ff5a5a", "l": "#8a6aa8", "p": "#7a4c9c" },
    grid: [
      "................",
      "................",
      "................",
      "................",
      "...l........l...",
      "..l.l.oooo.l.l..",
      ".l..lobbbbol..l.",
      "llllobpbbpbollll",
      ".l..obbbbeeo..l.",
      "..l.oBbbbbBo.l..",
      ".l.l.oBBBBo.l.l.",
      "l...l.oooo.l...l",
      "................",
      "................",
      "................",
      "................"
    ]
  },
  giant_spider: {
    pal: { ".": null, "o": SPR_OUTLINE, "b": "#3d2a3a", "B": "#241722", "e": "#ffe75a", "r": "#d63a3a", "l": "#9a7a90", "p": "#6a4a64", "t": "#f4f0f0" },
    grid: [
      "................",
      "...l........l...",
      "..l.l.oooo.l.l..",
      ".l..oBbrrbbBo..l",
      "l.loBbbrrbbBol.l",
      "llloBbbbbbbBolll",
      "l..oBBbbbbBBo..l",
      "...ooBBBBBBoo...",
      "..looobbbbooool.",
      ".l.lobeebeebol.l",
      "l.l.obbbbbbo.l.l",
      "l...l.otoot.l..l",
      "....l..t..t.l...",
      "................",
      "................",
      "................"
    ]
  },
  slime: {
    pal: { ".": null, "o": SPR_OUTLINE, "g": "#5ed48a", "G": "#2e9c5c", "d": "#1e6d42", "h": "#c6ffe0", "e": "#15111a", "w": "#ffffff" },
    grid: [
      "................",
      "................",
      "................",
      "................",
      "......oooo......",
      ".....ogggho.....",
      "....oggghhho....",
      "...ogggggghgo...",
      "...oggeggggeo...",
      "..ogggewggewgo..",
      "..oGgggggggggo..",
      "..oGGgggggggGo..",
      ".oGGGGggggGGGGo.",
      ".odGGGGGGGGGGdo.",
      "..oooooooooooo..",
      "................"
    ]
  },
  fire_imp: {
    pal: { ".": null, "o": SPR_OUTLINE, "r": "#d64a2a", "R": "#8e2a14", "y": "#ffd23f", "Y": "#ff8a2a", "w": "#fff2b0", "e": "#ffffff", "n": "#15111a", "h": "#3a1a10" },
    grid: [
      "................",
      "......y...y.....",
      ".....oYo.oYo....",
      "...o.ohho.ohoo..",
      "..oh.ohhhhhhoo..",
      "..ohoorrrrrrro..",
      "...oorRrrrrrro..",
      "....orrerrerrooY",
      "....orrnrrnrro.y",
      ".....orrrrrro.oY",
      "....oorRrrRroorY",
      "...orrorrrrrorro",
      "..oRRo.orrro.oo.",
      "..oRo..oRoRo....",
      "...o..oo..oo....",
      "................"
    ]
  },
  bog_troll: {
    pal: { ".": null, "o": SPR_OUTLINE, "g": "#6e8a3e", "G": "#4b6128", "d": "#2f3f1a", "m": "#9fbf4a", "e": "#ffe75a", "t": "#f4f0e0", "b": "#7a5a34", "B": "#4e3a22", "n": "#15111a" },
    grid: [
      "....oooooo......",
      "...omgggggmo....",
      "..oggmGgggggo...",
      "..oGgegggegGo...",
      "..oGgnggggngo..o",
      "..oGGtggggtGo.ob",
      ".ooooGGGGGGoo.ob",
      "oggggGgggggggoob",
      "oGggggmgggGgggBB",
      "oGGggggggggGgoBb",
      "ooGGgggGGggGGooo",
      ".oGGGoGGGGGoGGo.",
      "..ooooGGGGGoooo.",
      "....oGGGoGGGo...",
      "....oGGo.oGGo...",
      "....oooo.oooo..."
    ]
  },
  wraith: {
    pal: { ".": null, "o": "#2a3a5a", "w": "#b8d8f0", "W": "#7aa8d8", "d": "#3f6fa8", "e": "#a8ffff", "E": "#ffffff", "n": "#0b1424", "h": "#1c2a48" },
    grid: [
      "......oooo......",
      ".....ohhhho.....",
      "....ohhhhhho....",
      "....ohnEnEho....",
      "....ohneneho....",
      ".....ohhhho.....",
      "...oowWWWWwoo...",
      "..owwwWWWWwwwo..",
      "..owWWWWWWWWwo..",
      "..oWWWWWWWWWWo..",
      "..oWWWdWWWdWWo..",
      "..oWdWWWdWWWdo..",
      "...oWoWWoWWoW...",
      "...oW.oWo.oWo...",
      "....o..o...o....",
      "................"
    ]
  },

  // =============== İNSANSILAR ===============
  bandit: {
    pal: { ".": null, "o": SPR_OUTLINE, "h": "#5c4a34", "H": "#3e3222", "s": "#e9b587", "n": "#3a2418", "g": "#4d8a4a", "G": "#2f5c2f",
           "b": "#8a6a48", "B": "#5a4630", "m": "#c8d0d8", "y": "#e5b640", "k": "#2a2530" },
    grid: [
      "................",
      ".....oooooo.....",
      "....ohhhhhho....",
      "...ohHhhhhHho...",
      "...ohossssho....",
      "...ohonssnho....",
      "...oohgggggo....",
      "....oGGGGGo..oo.",
      "...obbbbbbbo.omo",
      "..obBbbbbBbboomo",
      "..obbkbbbbkbokoo",
      "..obBkkkkkkbooo.",
      "..oooBbbbBoo....",
      "....oBboBBo.....",
      "....oBo.oBo.....",
      "....oo...oo....."
    ]
  },
  bandit_archer: {
    pal: { ".": null, "o": SPR_OUTLINE, "h": "#3e5a3a", "H": "#2a3e26", "s": "#e9b587", "n": "#3a2418", "b": "#7a5a3a", "B": "#4e3a22",
           "m": "#c8d0d8", "w": "#a67c4a", "k": "#2a2530", "t": "#e0dcd0", "f": "#d43a3a" },
    grid: [
      "..f..oooooo.....",
      ".oto.ohhhhho....",
      ".oto.hHhhhhHo...",
      ".ot.ohossssho...",
      "....ohonssnho...",
      "....oohbbbbo....",
      ".....oBBBBo...ow",
      "....obbbbbbo.owo",
      "...obBbbbBbboww.",
      "...obbbbbbbbowo.",
      "...obBkkkkBbowo.",
      "...oooBbbBoooww.",
      ".....oBboBBo.ow.",
      ".....oBo.oBo..o.",
      ".....oo...oo....",
      "................"
    ]
  },
  bandit_chief: {
    pal: { ".": null, "o": SPR_OUTLINE, "r": "#c43a3a", "R": "#7d2222", "s": "#e9b587", "n": "#3a2418", "h": "#2a2530",
           "b": "#6a4a2a", "B": "#3f2c18", "y": "#f0c040", "Y": "#a67c1e", "m": "#d0d8e0", "M": "#8090a0", "k": "#15111a", "c": "#8e2a2a" },
    grid: [
      "....orrrrro.....",
      "...orRrrrrRro...",
      "...oRoossssoo...",
      "...ohossssso....",
      "...ohonssnso....",
      "....ossshhso..oo",
      "....oyhhhhyo.omo",
      "...oobBbbBoooomo",
      "..ocbbybybbbomMo",
      ".oRcbbbbbbbbomMo",
      ".oRcbBbbbbBbooYo",
      ".oRcbbyyyybbo.yo",
      ".oRocBbbbbBbo.yo",
      "..o.oBBboBBBo.o.",
      "....oBBo.oBBo...",
      "....oooo.oooo..."
    ]
  },
  goblin: {
    pal: { ".": null, "o": SPR_OUTLINE, "g": "#7fb84a", "G": "#4f7a2a", "d": "#33521a", "e": "#ffd23f", "n": "#15111a",
           "b": "#8a6a48", "B": "#5a4630", "t": "#e7e0cc", "w": "#8b5a2b" },
    grid: [
      "................",
      "................",
      "................",
      "...o.......o....",
      "..ogo.oooo.ogo..",
      "..oggogggggogo..",
      "...oggGggggggo..",
      "....oggegggeo...",
      "....ogGnggnGo.ow",
      ".....ogtggtoo.ow",
      "....ooGGGGoooooo",
      "...obbBbbBbboBBo",
      "...obbbbbbbbo.o.",
      "....oGGoGGo.....",
      "....oGo.oGo.....",
      "....oo...oo....."
    ]
  },
  goblin_shaman: {
    pal: { ".": null, "o": SPR_OUTLINE, "g": "#7fb84a", "G": "#4f7a2a", "e": "#ffd23f", "n": "#15111a", "f": "#d43a3a", "F": "#3f78c8",
           "p": "#5a3aa0", "P": "#3b2470", "t": "#e7e0cc", "w": "#8b5a2b", "c": "#66ffb0", "y": "#e5b640" },
    grid: [
      ".....f.F.f......",
      "....ofoFofo.....",
      "...ooffFffoo...c",
      "..ogooooooogo.ct",
      "..oggogggggogoct",
      "...oggGggggggoco",
      "....oggegggeo.ow",
      "....ogGnggnGo.ow",
      ".....ogtggtoo.ow",
      "....oopppppoo.ow",
      "...opPpypyppp.ow",
      "...oppppppppoooo",
      "...opPpppppPo.o.",
      "....oppppppo....",
      "....oPPo.oPo....",
      "....oooo.ooo...."
    ]
  },
  cultist: {
    pal: { ".": null, "o": SPR_OUTLINE, "r": "#7d1f2e", "R": "#4e1220", "d": "#2c0a12", "s": "#d9a878", "n": "#15111a",
           "m": "#c8d0d8", "y": "#e5b640", "k": "#2a2530" },
    grid: [
      "................",
      ".....oooo.......",
      "....orrrro......",
      "...orRrrrRo.....",
      "...orrddddro....",
      "...orrdndndo....",
      "...orrddsdro....",
      "....orrrrro.....",
      "...ooRrryrRoo...",
      "..orrrrryrrrro.o",
      "..orRrrrrrrRro.m",
      "..orrrrrrrrrromo",
      "..orRrrrrrrRrooo",
      "..orrrrrrrrrro..",
      "..oRRRRRRRRRRo..",
      "..oooooooooooo.."
    ]
  },
  cultist_priest: {
    pal: { ".": null, "o": SPR_OUTLINE, "p": "#3d2560", "P": "#251540", "d": "#140a24", "y": "#f0c040", "Y": "#a67c1e", "n": "#15111a",
           "c": "#c05aff", "C": "#7a2ad8", "r": "#7d1f2e" },
    grid: [
      "......oco.......",
      ".....oooo.......",
      "....oppppo....oo",
      "...opPppppo..occ",
      "...oppyyyypo.oCo",
      "...oppynynpo.oYo",
      "...oppyyyypo.oyo",
      "....oppyypo..oYo",
      "...ooPprrPoo.oyo",
      "..oppppyyppppoYo",
      "..opPpyppypPpoyo",
      "..oppppyyppppoYo",
      "..opPpppppppPoyo",
      "..oppppppppppoYo",
      "..oPPPPPPPPPPo.o",
      "..oooooooooooo.."
    ]
  },
  orc_brute: {
    pal: { ".": null, "o": SPR_OUTLINE, "g": "#6f8c58", "G": "#465e36", "d": "#2c3c22", "e": "#ffd23f", "n": "#15111a", "t": "#f4f0e0",
           "b": "#5a3f24", "B": "#3a2814", "m": "#b0b8c0", "M": "#6c7680", "r": "#8e2a2a", "k": "#15111a" },
    grid: [
      "...oooooooo.....",
      "..oGGggggggo..oo",
      "..oGggggggggo.mo",
      "..oGgegggegGo.mo",
      "..oGgnggggngoomo",
      "..oGgtggggtgomMo",
      "...oGGGggGGomMMo",
      ".oooGGGGGGGooMMo",
      "oggGGbbbbbbGggMo",
      "oGgGGbBbbBbGgGMo",
      "oGGGGbbbbbbGGGoo",
      "ooGGoBbbbbBoGoo.",
      ".oo.oBBoBBBo.o..",
      "....oBBooBBo....",
      "....oBBo.oBBo...",
      "....oooo.oooo..."
    ]
  },

  // =============== ÖLÜMSÜZLER ===============
  skeleton: {
    pal: { ".": null, "o": SPR_OUTLINE, "w": "#ece6d6", "W": "#b8ae98", "d": "#7a715e", "n": "#15111a", "e": "#8ef0ff",
           "m": "#c8d0d8", "b": "#6a4a2a", "B": "#3f2c18", "r": "#8e2a2a", "y": "#a67c1e" },
    grid: [
      "................",
      ".....oooooo.....",
      "....owwwwwwo....",
      "....owWwwwWo....",
      "....ownwwnwo....",
      "....oweWWewo....",
      ".....owWwWo..omo",
      "....ooowwooo.omo",
      "...oBbWwWwWo.omo",
      "..obBBWwwWWo.omo",
      "..obBBwWWWwooyyy",
      "..oBBBWwWwWWWWyo",
      "...ooooWwWo..oyo",
      ".....oWoowo.....",
      ".....oWo.oWo....",
      ".....oo...oo...."
    ]
  },
  skeleton_archer: {
    pal: { ".": null, "o": SPR_OUTLINE, "w": "#ece6d6", "W": "#b8ae98", "d": "#7a715e", "n": "#15111a", "e": "#8ef0ff",
           "b": "#8b5a2b", "B": "#5a3a1a", "k": "#3a2a3a", "t": "#e0dcd0", "y": "#a67c4a" },
    grid: [
      "................",
      ".....oooooo.....",
      "....owwwwwwo....",
      "....okkkkkko....",
      "....ownwwnwo....",
      "....oweWWewo..oy",
      ".....owWwWo..oyo",
      "....ooowwooo.oyo",
      "...obbWwWwWooyo.",
      "..obBBWwwWWoyyo.",
      "..obbbwWWWwoyo..",
      "..oBBBWwWwWoyo..",
      "...ooooWwWo.oyo.",
      ".....oWoowo..oy.",
      ".....oWo.oWo..o.",
      ".....oo...oo...."
    ]
  },
  zombie: {
    pal: { ".": null, "o": SPR_OUTLINE, "g": "#8aa06a", "G": "#5f7446", "d": "#3f4f2c", "n": "#15111a", "e": "#e8f0a0",
           "b": "#5c5a6a", "B": "#3a3946", "r": "#8e2a3a", "t": "#d9d2b8" },
    grid: [
      "................",
      "......ooooo.....",
      ".....ogGgggo....",
      ".....oggggGo....",
      ".....oGegeggo...",
      ".....ognggngo...",
      "......ogtGgo....",
      ".....ooGggoooo..",
      "....obbGgGbbggo.",
      "...obBbbGbBboGgo",
      "...obbbbbbbbo.oo",
      "...obrBbbBbbo...",
      "....ooBbbboo....",
      ".....oBboBBo....",
      ".....oGo.oGo....",
      ".....oo...oo...."
    ]
  },
  ghoul: {
    pal: { ".": null, "o": SPR_OUTLINE, "g": "#9a8fb0", "G": "#6a6084", "d": "#463f5a", "n": "#15111a", "e": "#ff6a3a",
           "t": "#f0e8d8", "k": "#2a2536", "r": "#8e2a3a" },
    grid: [
      "................",
      "................",
      "................",
      "......oooooo....",
      ".....ogGggggo...",
      ".....ogeggego...",
      ".....ognGGngo...",
      "......otgtgo....",
      "...ooooGgGGoo...",
      "..ogGGgggggggoo.",
      ".ogGkkkGggGggGgo",
      ".oGGkkkGggGGgooo",
      "..oGGoGGGGGGGto.",
      "...ooGGGGoGGto..",
      "....oGGooGGto...",
      "....ooo..ooo...."
    ]
  },
  knight_fallen: {
    pal: { ".": null, "o": SPR_OUTLINE, "a": "#3a3546", "A": "#242030", "d": "#15111a", "e": "#c05aff", "E": "#f0c0ff",
           "r": "#8e2a2a", "R": "#5a1818", "m": "#9aa2b0", "M": "#5c6472", "y": "#a67c1e", "h": "#6a6480" },
    grid: [
      "......oooo......",
      ".....oaaaao.....",
      "....oaAAAAao....",
      "....oaddddao....",
      "....oadEeEdao...",
      "....oaddddao.oMo",
      ".....oaaaao..oMo",
      "...ooohaaoooooMo",
      "..oRraAaAAaoomMo",
      ".oRRraAaaAAaomMo",
      ".oRRraaAAAaaoomo",
      ".oRRraAaaaAaoyyo",
      ".oRRoaaAAAAaooy.",
      "..ooohAAoAAAo.o.",
      "....oAAo.oAAo...",
      "....oooo.oooo..."
    ]
  },
  lich: {
    pal: { ".": null, "o": SPR_OUTLINE, "w": "#e8e0d0", "W": "#b0a690", "n": "#15111a", "e": "#66ffb0", "E": "#d0ffe8",
           "p": "#2d1f4e", "P": "#1a1130", "y": "#f0c040", "Y": "#a67c1e", "g": "#39d98a", "G": "#1e8a55", "k": "#0e0a18" },
    grid: [
      "...y..y.y..y....",
      "...oyyyyyyyo....",
      "...oyYYYYYyo....",
      "....owwwwwo...oe",
      "....owEeEwo..oEe",
      "....owneneo..oeo",
      ".....owWwo...ogo",
      "....ooowooo..ogo",
      "...opPpggpPo.ogo",
      "..oppppygpppoogo",
      "..opPpggpPpp.ogo",
      "..oppppyppppoogo",
      "..opPppgpPppoogo",
      "..oppppppppp.ogo",
      "..oPPPPPPPPPo.o.",
      "..oooooooooooo.."
    ]
  }
};

// ---------- Kare (frame) üretimi ----------
// Ana grid'den idle 2. kare: sprite'ın üst kısmını 1 piksel aşağı kaydırır (nefes alma).
// splitRow: bu satırın üstündeki bölüm kayar; alt kısım (bacaklar) sabit kalır.
function spriteBobFrame(grid, splitRow) {
  const out = grid.slice();
  // üst bölümü 1 aşağı kaydır: splitRow-1 satırı splitRow'a taşınır...
  for (let y = splitRow; y > 0; y--) out[y] = grid[y - 1];
  out[0] = "................";
  // kayan bölümün en alt satırı ile sabit bölümün ilk satırı üst üste binmesin diye
  // splitRow satırında orijinal ile birleştir (saydam olmayan pikseller korunur)
  const merged = [];
  for (let x = 0; x < 16; x++) {
    const a = out[splitRow][x], b = grid[splitRow][x];
    merged.push(a !== "." ? a : b);
  }
  out[splitRow] = merged.join("");
  return out;
}
// Grid'i 1 piksel yukarı taşı (uçan/hayalet için)
function spriteShiftUp(grid) {
  const out = grid.slice(1);
  out.push("................");
  return out;
}
// Slime/troll benzeri "ezilme": alt satır dışında dikey sıkıştırma yok; basitçe üstü 1 aşağı al
const SPR_BOB_SPLIT = {
  fighter: 12, cleric: 13, wizard: 14, bandit: 12, bandit_archer: 12, bandit_chief: 12, goblin: 12, goblin_shaman: 13,
  cultist: 14, cultist_priest: 14, orc_brute: 12, skeleton: 12, skeleton_archer: 12, zombie: 12, ghoul: 13,
  knight_fallen: 13, lich: 14, bog_troll: 12, slime: 13, fire_imp: 12,
  wolf: 8, direwolf_alpha: 8, spider: 8, giant_spider: 8
};

(function buildFrames() {
  for (const id in Sprites) {
    const s = Sprites[id];
    if (s.frames) continue;
    let f2;
    if (id === "wraith") f2 = spriteShiftUp(s.grid);
    else f2 = spriteBobFrame(s.grid, SPR_BOB_SPLIT[id] || 12);
    s.frames = [s.grid, f2];
  }
})();

// ---------- Saldırı karesi ----------
// Elle çizilmiş saldırı kareleri (yoksa prosedürel "hamle": üst gövde 2px, alt 1px öne kayar)
const ATTACK_FRAMES = {
  fighter: [
    ".......rrr......",
    "......orRro.....",
    ".....oaaaaao....",
    "....oaAAAAAao...",
    "....oaossssao...",
    "....oaonssnao...",
    ".....oassso.....",
    "....ooAaAoo.....",
    "..obbAaaaAAooooo",
    ".obBwbAaaAAsymmm",
    ".obwwbAaaAAooooo",
    ".obBwbAAaAAAo...",
    "..obboAAAAAo....",
    "....odAoAdo.....",
    "....odo.odo.....",
    "....oo...oo....."
  ],
  wolf: [
    "................",
    "..........o..o..",
    ".........ofoofo.",
    "..oo.....offffo.",
    ".oFfoooooofffFeo",
    ".oFfoffffffffnto",
    "..oFfffffffffoto",
    "...oFFFfffffoo..",
    "...oFFFFFFffo...",
    "..ooFFooFFFFo...",
    ".oFo...oFooFFo..",
    ".oo....oo..oFo..",
    "............oo..",
    "................",
    "................",
    "................"
  ]
};
function spriteLungeFrame(grid, splitRow) {
  const out = [];
  for (let y = 0; y < 16; y++) {
    const d = y < splitRow ? 2 : 1;
    const row = grid[y];
    out.push(("." .repeat(d) + row).slice(0, 16));
  }
  return out;
}
(function buildAttackFrames() {
  for (const id in Sprites) {
    const s = Sprites[id];
    if (s.attackFrame) continue;
    s.attackFrame = ATTACK_FRAMES[id] || spriteLungeFrame(s.grid, SPR_BOB_SPLIT[id] || 12);
  }
})();

// Grid'i doğrula (geliştirme yardımcısı) — hatalı satır uzunluğu veya tanımsız harf
function validateSprites() {
  const errs = [];
  for (const id in Sprites) {
    const s = Sprites[id];
    [s.frames[0], s.frames[1], s.attackFrame].forEach((g, fi) => {
      if (g.length !== 16) errs.push(id + " frame" + fi + ": " + g.length + " satır");
      g.forEach((row, y) => {
        if (row.length !== 16) errs.push(id + " frame" + fi + " satır " + y + ": uzunluk " + row.length);
        for (const ch of row) if (!(ch in s.pal)) errs.push(id + " frame" + fi + " satır " + y + ": tanımsız '" + ch + "'");
      });
    });
  }
  return errs;
}

// ---------- Çizim ----------
// Sprite'ı hex merkezine çiz (px = piksel büyüklüğü). flip=true → yatay çevir (sola bakar).
function drawSpriteFrame(ctx, spr, cx, cy, px, frame, flip) {
  if (!spr) return;
  let grid;
  if (frame === "attack") grid = spr.attackFrame || spr.grid;
  else if (frame === "hurt") grid = spr.grid;
  else grid = (spr.frames && spr.frames[(frame | 0) % spr.frames.length]) || spr.grid;
  const pal = spr.pal;
  const n = 16;
  const ox = Math.round(cx - n * px / 2);
  const oy = Math.round(cy - n * px / 2 - px * 2); // biraz yukarı kaldır
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (!col) continue;
      ctx.fillStyle = col;
      const dx = flip ? (n - 1 - x) : x;
      ctx.fillRect(ox + dx * px, oy + y * px, px, px);
    }
  }
}
function drawSpriteGrid(ctx, spr, cx, cy, px, flip) {
  drawSpriteFrame(ctx, spr, cx, cy, px, 0, !!flip);
}

// Renkli flaş (ör. hasar: beyaz, zehir: yeşil). frame: 0|1|"attack"; color: "#fff"; alpha: 0..1
function drawSpriteTint(ctx, spr, cx, cy, px, frame, flip, color, alpha) {
  if (!spr) return;
  drawSpriteFrame(ctx, spr, cx, cy, px, frame || 0, !!flip);
  let grid;
  if (frame === "attack") grid = spr.attackFrame || spr.grid;
  else grid = (spr.frames && spr.frames[(frame | 0) % spr.frames.length]) || spr.grid;
  const n = 16;
  const ox = Math.round(cx - n * px / 2);
  const oy = Math.round(cy - n * px / 2 - px * 2);
  ctx.save();
  ctx.globalAlpha = alpha == null ? 0.7 : Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = color || "#ffffff";
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      if (!spr.pal[row[x]]) continue;
      const dx = flip ? (n - 1 - x) : x;
      ctx.fillRect(ox + dx * px, oy + y * px, px, px);
    }
  }
  ctx.restore();
}
