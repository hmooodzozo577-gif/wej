// Flight paths, in each SVG's own viewBox units, written in the direction
// of travel and authored for LTR (the band mirrors itself in RTL). Every
// path starts and ends OUTSIDE its visible area — beyond a clipped edge of
// its section, card or photo — so a plane is seen entering, crossing the
// whole route and leaving, never appearing or vanishing mid-route. The same
// strings drive the drawn dashed route and the plane's CSS `offset-path`
// (see wejhaty.css), so a plane always flies the line the reader can see.
export const FLIGHT_PATHS = {
  homeTop: 'M-60 46 C180 18 400 64 620 36 S900 22 1060 44',
  homeBottom: 'M1060 30 C820 54 600 16 380 40 S120 58 -60 30',
  howA: 'M790 150 C640 190 500 140 420 90 S300 10 240 -50',
  howB: 'M470 -50 C500 40 580 90 660 110 S760 140 800 190',
  purpose: 'M300 -50 C340 90 460 190 580 160 S720 60 790 40',
  exploreA: 'M-80 50 C220 20 470 64 720 40 S1130 60 1290 104 S1440 150 1520 132',
  exploreB: 'M1520 196 C1250 212 1010 170 860 150 S700 70 560 40 S240 16 -80 30',
  surprise: 'M650 118 C520 140 420 110 340 76 S210 20 170 -40',
  destination: 'M1280 150 C1020 170 820 90 620 70 S240 60 -80 20',
  quizA: 'M-80 34 C200 14 460 52 700 30 S1060 16 1280 38',
  quizB: 'M1280 70 C1000 82 760 58 520 72 S160 86 -80 66',
} as const;
