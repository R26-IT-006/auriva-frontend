// All require() paths are static — Metro bundles them at build time.
// Images without a file yet fall back to the emoji in WordImageDisplay.
// Filename notes:
//   ice_cream.jpg — underscore in filename
//   x-ray.jpg     — hyphen in filename
//   xmas-tree.jpg — hyphen in filename

const WORD_IMAGES = {
  // ── A ──────────────────────────────────────────────────────────────────────
  ant:        require('../../assets/words/A/3-letter/ant.jpg'),
  axe:        require('../../assets/words/A/3-letter/axe.jpg'),
  album:      require('../../assets/words/A/5-letter/album.jpg'),
  apple:      require('../../assets/words/A/5-letter/apple.jpg'),
  arrow:      require('../../assets/words/A/5-letter/arrow.jpg'),

  // ── B ──────────────────────────────────────────────────────────────────────
  box:        require('../../assets/words/B/3-letter/box.jpg'),
  bee:        require('../../assets/words/B/3-letter/bee.jpg'),
  bun:        require('../../assets/words/B/3-letter/bun.jpg'),
  bus:        require('../../assets/words/B/3-letter/bus.jpg'),
  bell:       require('../../assets/words/B/4-letter/bell.jpg'),
  book:       require('../../assets/words/B/4-letter/book.jpg'),
  ball:       require('../../assets/words/B/4-letter/ball.jpg'),
  butterfly:  require('../../assets/words/B/More/butterfly.jpg'),
  banana:     require('../../assets/words/B/More/banana.jpg'),
  balloon:    require('../../assets/words/B/More/balloon.jpg'),

  // ── C ──────────────────────────────────────────────────────────────────────
  cat:        require('../../assets/words/C/3-letter/cat.jpg'),
  cup:        require('../../assets/words/C/3-letter/cup.jpg'),
  cap:        require('../../assets/words/C/3-letter/cap.jpg'),
  car:        require('../../assets/words/C/3-letter/car.jpg'),
  cow:        require('../../assets/words/C/3-letter/cow.jpg'),
  cake:       require('../../assets/words/C/4-letter/cake.jpg'),
  computer:   require('../../assets/words/C/More/computer.jpg'),
  camera:     require('../../assets/words/C/More/camera.jpg'),
  calendar:   require('../../assets/words/C/More/calendar.jpg'),

  // ── D ──────────────────────────────────────────────────────────────────────
  dog:        require('../../assets/words/D/3-letter/dog.jpg'),
  duck:       require('../../assets/words/D/4-letter/duck.jpg'),
  drum:       require('../../assets/words/D/4-letter/drum.jpg'),
  door:       require('../../assets/words/D/4-letter/door.jpg'),
  deer:       require('../../assets/words/D/4-letter/deer.jpg'),
  desk:       require('../../assets/words/D/4-letter/desk.jpg'),

  // ── E ──────────────────────────────────────────────────────────────────────
  egg:        require('../../assets/words/E/3-letter/egg.jpg'),
  elf:        require('../../assets/words/E/3-letter/elf.jpg'),
  eight:      require('../../assets/words/E/5-letter/eight.jpg'),
  engine:     require('../../assets/words/E/More/engine.jpg'),
  elephant:   require('../../assets/words/E/More/elephant.jpg'),

  // ── F ──────────────────────────────────────────────────────────────────────
  fan:        require('../../assets/words/F/3-letter/fan.jpg'),
  fox:        require('../../assets/words/F/3-letter/fox.jpg'),
  fog:        require('../../assets/words/F/3-letter/fog.jpg'),
  fish:       require('../../assets/words/F/4-letter/fish.jpg'),
  fork:       require('../../assets/words/F/4-letter/fork.jpg'),
  fire:       require('../../assets/words/F/4-letter/fire.jpg'),
  flag:       require('../../assets/words/F/4-letter/flag.jpg'),
  four:       require('../../assets/words/F/4-letter/four.jpg'),
  five:       require('../../assets/words/F/4-letter/five.jpg'),
  flower:     require('../../assets/words/F/More/flower.jpg'),

  // ── G ──────────────────────────────────────────────────────────────────────
  goat:       require('../../assets/words/G/4-letter/goat.jpg'),
  gate:       require('../../assets/words/G/4-letter/gate.jpg'),
  grass:      require('../../assets/words/G/5-letter/grass.jpg'),
  grapes:     require('../../assets/words/G/More/grapes.jpg'),
  gloves:     require('../../assets/words/G/More/gloves.jpg'),

  // ── H ──────────────────────────────────────────────────────────────────────
  hat:        require('../../assets/words/H/3-letters/hat.jpg'),
  hen:        require('../../assets/words/H/3-letters/hen.jpg'),
  horse:      require('../../assets/words/H/5-letters/horse.jpg'),
  house:      require('../../assets/words/H/5-letters/house.jpg'),
  hammer:     require('../../assets/words/H/More/hammer.jpg'),
  helicopter: require('../../assets/words/H/More/helicopter.jpg'),

  // ── I ──────────────────────────────────────────────────────────────────────
  ink:        require('../../assets/words/I/3-letters/ink.jpg'),
  ice:        require('../../assets/words/I/3-letters/ice.jpg'),
  iron:       require('../../assets/words/I/4-letters/iron.jpg'),
  igloo:      require('../../assets/words/I/5-letters/igloo.jpg'),
  icecream:   require('../../assets/words/I/More/ice_cream.jpg'),

  // ── J ──────────────────────────────────────────────────────────────────────
  jam:        require('../../assets/words/J/3-letters/jam.jpg'),
  jug:        require('../../assets/words/J/3-letters/jug.jpg'),
  jet:        require('../../assets/words/J/3-letters/jet.jpg'),
  jeep:       require('../../assets/words/J/4-letters/jeep.jpg'),

  // ── K ──────────────────────────────────────────────────────────────────────
  key:        require('../../assets/words/K/3-letters/key.jpg'),
  kite:       require('../../assets/words/K/4-letters/kite.jpg'),
  kiwi:       require('../../assets/words/K/4-letters/kiwi.jpg'),
  king:       require('../../assets/words/K/4-letters/king.jpg'),
  kangaroo:   require('../../assets/words/K/More/kangaroo.jpg'),
  kettle:     require('../../assets/words/K/More/kettle.jpg'),
  kitten:     require('../../assets/words/K/More/kitten.jpg'),

  // ── L ──────────────────────────────────────────────────────────────────────
  log:        require('../../assets/words/L/3-letters/log.jpg'),
  leg:        require('../../assets/words/L/3-letters/leg.jpg'),
  lion:       require('../../assets/words/L/4-letters/lion.jpg'),
  leaf:       require('../../assets/words/L/4-letters/leaf.jpg'),
  lips:       require('../../assets/words/L/4-letters/lips.jpg'),
  lotus:      require('../../assets/words/L/5-letters/lotus.jpg'),
  ladder:     require('../../assets/words/L/More/ladder.jpg'),

  // ── M ──────────────────────────────────────────────────────────────────────
  mug:        require('../../assets/words/M/3-letters/mug.jpg'),
  moon:       require('../../assets/words/M/4-letters/moon.jpg'),
  mouse:      require('../../assets/words/M/5-letters/mouse.jpg'),
  mango:      require('../../assets/words/M/5-letters/mango.jpg'),
  monkey:     require('../../assets/words/M/More/monkey.jpg'),

  // ── N ──────────────────────────────────────────────────────────────────────
  net:        require('../../assets/words/N/3-letters/net.jpg'),
  nail:       require('../../assets/words/N/4-letters/nail.jpg'),
  nest:       require('../../assets/words/N/4-letters/nest.jpg'),
  nine:       require('../../assets/words/N/4-letters/nine.jpg'),
  nose:       require('../../assets/words/N/4-letters/nose.jpg'),
  needle:     require('../../assets/words/N/More/needle.jpg'),

  // ── O ──────────────────────────────────────────────────────────────────────
  one:        require('../../assets/words/O/3-letters/one.jpg'),
  owl:        require('../../assets/words/O/3-letters/owl.jpg'),
  oval:       require('../../assets/words/O/4-letters/oval.jpg'),
  organ:      require('../../assets/words/O/5-letters/organ.jpg'),
  otter:      require('../../assets/words/O/5-letters/otter.jpg'),
  orange:     require('../../assets/words/O/More/orange.jpg'),
  ostrich:    require('../../assets/words/O/More/ostrich.jpg'),

  // ── P ──────────────────────────────────────────────────────────────────────
  pot:        require('../../assets/words/P/3-letters/pot.jpg'),
  pen:        require('../../assets/words/P/3-letters/pen.jpg'),
  parrot:     require('../../assets/words/P/More/parrot.jpg'),
  papaya:     require('../../assets/words/P/More/papaya.jpg'),
  penguin:    require('../../assets/words/P/More/penguin.jpg'),
  peacock:    require('../../assets/words/P/More/peacock.jpg'),

  // ── Q ──────────────────────────────────────────────────────────────────────
  quilt:      require('../../assets/words/Q/5-letters/quilt.jpg'),
  quail:      require('../../assets/words/Q/5-letters/quail.jpg'),
  queen:      require('../../assets/words/Q/5-letters/queen.jpg'),
  queue:      require('../../assets/words/Q/5-letters/queue.jpg'),
  // quarter — no image yet, shows emoji fallback

  // ── R ──────────────────────────────────────────────────────────────────────
  rose:       require('../../assets/words/R/4-letters/rose.jpg'),
  rake:       require('../../assets/words/R/4-letters/rake.jpg'),
  river:      require('../../assets/words/R/5-letters/river.jpg'),
  rabbit:     require('../../assets/words/R/More/rabbit.jpg'),
  rainbow:    require('../../assets/words/R/More/rainbow.jpg'),

  // ── S ──────────────────────────────────────────────────────────────────────
  sun:        require('../../assets/words/S/3-letters/sun.jpg'),
  six:        require('../../assets/words/S/3-letters/six.jpg'),
  star:       require('../../assets/words/S/4-letters/star.jpg'),
  sand:       require('../../assets/words/S/4-letters/sand.jpg'),
  sack:       require('../../assets/words/S/4-letters/sack.jpg'),
  snake:      require('../../assets/words/S/5-letters/snake.jpg'),
  snail:      require('../../assets/words/S/5-letters/snail.jpg'),
  skirt:      require('../../assets/words/S/5-letters/skirt.jpg'),
  scarf:      require('../../assets/words/S/5-letters/scarf.jpg'),
  seven:      require('../../assets/words/S/5-letters/seven.jpg'),

  // ── T ──────────────────────────────────────────────────────────────────────
  two:        require('../../assets/words/T/3-letters/two.jpg'),
  ten:        require('../../assets/words/T/3-letters/ten.jpg'),
  tree:       require('../../assets/words/T/4-letters/tree.jpg'),
  train:      require('../../assets/words/T/5-letters/train.jpg'),
  three:      require('../../assets/words/T/5-letters/three.jpg'),
  toffee:     require('../../assets/words/T/More/toffee.jpg'),
  tortoise:   require('../../assets/words/T/More/tortoise.jpg'),

  // ── U ──────────────────────────────────────────────────────────────────────
  umpire:     require('../../assets/words/U/More/umpire.jpg'),
  umbrella:   require('../../assets/words/U/More/umbrella.jpg'),

  // ── V ──────────────────────────────────────────────────────────────────────
  van:        require('../../assets/words/V/3-letters/van.jpg'),
  vase:       require('../../assets/words/V/4-letters/vase.jpg'),
  violin:     require('../../assets/words/V/More/violin.jpg'),
  volleyball: require('../../assets/words/V/More/volleyball.jpg'),
  vegetables: require('../../assets/words/V/More/vegetables.jpg'),

  // ── W ──────────────────────────────────────────────────────────────────────
  wolf:       require('../../assets/words/W/4-letters/wolf.jpg'),
  wind:       require('../../assets/words/W/4-letters/wind.jpg'),
  well:       require('../../assets/words/W/4-letters/well.jpg'),
  watch:      require('../../assets/words/W/5-letters/watch.jpg'),
  watermelon: require('../../assets/words/W/More/watermelon.jpg'),

  // ── X ──────────────────────────────────────────────────────────────────────
  xray:       require('../../assets/words/X/4-letters/x-ray.jpg'),
  xylophone:  require('../../assets/words/X/More/xylophone.jpg'),
  xmastree:   require('../../assets/words/X/More/xmas-tree.jpg'),

  // ── Y ──────────────────────────────────────────────────────────────────────
  yak:        require('../../assets/words/Y/3-letters/yak.jpg'),
  yarn:       require('../../assets/words/Y/4-letters/yarn.jpg'),
  yolk:       require('../../assets/words/Y/4-letters/yolk.jpg'),
  yoyo:       require('../../assets/words/Y/4-letters/yoyo.jpg'),
  yacht:      require('../../assets/words/Y/5-letters/yacht.jpg'),

  // ── Z ──────────────────────────────────────────────────────────────────────
  zoo:        require('../../assets/words/Z/3-letters/zoo.jpg'),
  zero:       require('../../assets/words/Z/4-letters/zero.jpg'),
  zebra:      require('../../assets/words/Z/5-letters/zebra.jpg'),
  zipper:     require('../../assets/words/Z/More/zipper.jpg'),
  zigzag:     require('../../assets/words/Z/More/zigzag.jpg'),
};

export default WORD_IMAGES;
