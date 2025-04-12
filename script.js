function multProb(prob, mult){
  //multiplies probability
  return 1-Math.pow(1-prob, mult);
}

function rotatePoint(point, origin, angle) {
  let cos=Math.cos(angle), sin=Math.sin(angle);
  return [
    cos * ( point[0] - origin[0] ) - sin * ( point[1] - origin[1] ) + origin[0],
    sin * ( point[0] - origin[0] ) + cos * ( point[1] - origin[1] ) + origin[1]
  ];
}

function rectPointCollide(rX, rY, w, h, pX, pY){
  return pX>rX && pX<rX+w && pY>rY && pY<rY+h;
}

// players
let players = {
    fred: { powerup: { toClear: [] }, score: 0, ready: false },
    greenlee: { powerup: { toClear: [] }, score: 0, ready: false },
    pinkney: { powerup: { toClear: [] }, score: 0, ready: false },
    bluebell: { powerup: { toClear: [] }, score: 0, ready: false },
    willem: { powerup: { toClear: [] }, score: 0, ready: false },
    greydon: { powerup: { toClear: [] }, score: 0, ready: false },
}

let playerList=["fred","greenlee","pinkney","bluebell","willem","greydon"]

let achtung = {
    startScreen: true, // are we on the start screen?
    gameRunning: false, // are we playing?
    gameEnded: true, // are noone alive?
    winner: false, // do we have a winner?
    playing: [], // who's playing
    powerups: [
        "g_slow",
        "g_fast",
        "g_thin",
        "g_side",
        "g_invisible",
        "g_die",
        "r_slow",
        "r_fast",
        "r_thick",
        "r_reverse",
        "b_clear",
        "b_more",
        "b_sides",
        "o_random",
    ],
    powerupsOnScreen: [], // what powerups are on screen now
}

// variables
let canvasID,
    UIcanvas = document.querySelector("#ui_canvas"), // ui canvas
    dotsCanvas = document.querySelector("#dots_canvas"), // canvas for player dots
    trailsHitboxCanvas = document.querySelector("#trails_hitbox_canvas"), // canvas for player trails
    powerupVisualCanvas = document.querySelector("#powerup_visual_canvas"), // canvas for powerup icons
    ctxUI = UIcanvas.getContext("2d"),
    ctxDO = dotsCanvas.getContext("2d"),
    ctxTH = trailsHitboxCanvas.getContext("2d", { willReadFrequently: true }),
    ctxPV = powerupVisualCanvas.getContext("2d"),
    yellow = getComputedStyle(document.documentElement).getPropertyValue(`--yellow`), // colors
    green = getComputedStyle(document.documentElement).getPropertyValue(`--greenlee`),
    greent = getComputedStyle(document.documentElement).getPropertyValue(`--greenlee-t`),
    red = getComputedStyle(document.documentElement).getPropertyValue(`--fred`),
    redt = getComputedStyle(document.documentElement).getPropertyValue(`--fred-t`),
    blue = getComputedStyle(document.documentElement).getPropertyValue(`--blue`),
    bluet = getComputedStyle(document.documentElement).getPropertyValue(`--blue-t`),
    w,
    h,
    w100th,
    h100th,
    borderWidth,
    iconSizePx, // to be set in newSize()
    borderOpacity=1,
    lastFrame=-1

// when resizing
window.addEventListener("resize", newSize)

function newSize() {
    // update canvas sizes and variable sizes to fit new size
    const dpr = Math.min(window.devicePixelRatio, 2)
    w = Math.round(UIcanvas.getBoundingClientRect().width * dpr * 0.5)
    h = Math.round(UIcanvas.getBoundingClientRect().height * dpr * 0.5)
    UIcanvas.width = w
    UIcanvas.height = h
    dotsCanvas.width = w
    dotsCanvas.height = h
    trailsHitboxCanvas.width = w
    trailsHitboxCanvas.height = h
    powerupVisualCanvas.width = w
    powerupVisualCanvas.height = h
    w100th = w / 100 // 1 percent of canvas width
    h100th = h / 100 // 1 percent of canvas height
    borderWidth = 0.005*w/h // in part of field height
    iconSizePx = 0.02*w // in pixels
    drawGameUI()
    powerupDraw()
    //init() // restart
}

function init() {
    lastFrame=-1 // -1 so tFrame=0 > lastFrame
    borderOpacity=1
    achtung.powerupsOnScreen = [] // clear powerups on screen
    clearTimeout(achtung.clearSides) // clear timeout if sides powerup leftover time from last round
    achtung.sides = 0 // reset sides

    for (const player in players) {
        // reset players object to default values before starting a new round
        players[player].x = 0
        players[player].y = 0
        players[player].dir = 0
        players[player].turnL = false
        players[player].turnR = false
        players[player].color = getComputedStyle(document.documentElement).getPropertyValue(`--${player}`) // colors from css :root object
        players[player].alive = true
        players[player].winner = false
    }

    // clear everything
    ctxTH.clearRect(0, 0, w, h)
    ctxUI.clearRect(0, 0, w, h)
    ctxDO.clearRect(0, 0, w, h)
    ctxPV.clearRect(0, 0, w, h)

    // draw yellow border
    ctxDO.lineWidth = borderWidth*h
    ctxDO.strokeStyle = yellow
    ctxDO.strokeRect(borderWidth*h / 2, borderWidth*h / 2, h - borderWidth*h, h - borderWidth*h)

    drawGameUI() // draw ui
}

function readyPlayersAndScore(view, viewIndex){
  for(let player of playerList){
    players[player].ready=view.getUint8(viewIndex++) ? true : false
    players[player].score=view.getInt32(viewIndex);viewIndex+=4
  }
  drawGameUI()
}

document.addEventListener("keydown", (e) => {
    // update players turning to true if turning
    let playerIndex
    for (const player in players) {
        if (!players[player].alive) continue // if player not alive; skip
        playerIndex=playerList.indexOf(player)
        if (e.code == players[player].keyL) {
            ws.send(new Uint8Array([0,playerIndex,1,1]))
        }
        if (e.code == players[player].keyR) {
            ws.send(new Uint8Array([0,playerIndex, 2,1]))
        }
    }

    // if keydown == escape, go to start page
    if (e.code == "Escape") {
        achtung.startScreen = true
        achtung.gameEnded = true
        achtung.gameRunning = false
        startPage.style.display = "block"
        window.cancelAnimationFrame(canvasID)
        for (const player in players) {
            players[player].score = 0
        }
        init()
    }
    if (e.code == "Space") pressSpace()
})
document.addEventListener("keyup", (e) => {
    // update players turning to false when keyup
    let playerIndex
    for (const player in players) {
        if (!players[player].alive) continue // if player not alive; skip
        playerIndex=playerList.indexOf(player)
        if (e.code == players[player].keyL) {
            ws.send(new Uint8Array([0,playerIndex,1,0]))
        }
        if (e.code == players[player].keyR) {
            ws.send(new Uint8Array([0,playerIndex,2,0]))
        }
    }
})

//makes player ready and sends add player msg to server
function sendAddPlayer(player){
  players[player].ready=true
  ws.send(new Uint8Array([1,playerList.indexOf(player)]) )
}

//makes player not ready and sends remove player msg to server
function sendRemovePlayer(player){
  players[player].ready=false
  ws.send(new Uint8Array([2,playerList.indexOf(player)]) )
}

function addPlayer(view, viewIndex){
  players[playerList[view.getUint8(viewIndex++)] ].ready=true
}

function removePlayer(view, viewIndex){
  players[playerList[view.getUint8(viewIndex++)] ].ready=false
}

function pressSpace() {
    let playingC = 0
    for (const player in players) {
        if (players[player].ready) playingC++
    }
    
    let shouldSendSpace=true
    if (achtung.startScreen) {
        if (playingC >= 0) {
            // start game
            for (const player in players) {
                if (players[player].active && !players[player].ready) {
                    resetPlayer(document.querySelector(`.player_wrapper.${player}`))
                }
                if(players[player].ready) sendAddPlayer(player)
            }
            achtung.startScreen = false
            achtung.gameEnded = true
            startPage.style.display = "none"
            shouldSendSpace=false
            init()
        }
    }

    if (!achtung.gameEnded) {
        if (!achtung.gameRunning) {
            // resume game
            achtung.gameRunning = true
        } else {
            // pause game
            achtung.gameRunning = false
        }
    } else {
        // restart game
        if (achtung.winner) {
            achtung.winner = false
            achtung.startScreen = true
            achtung.gameEnded = true
            achtung.gameRunning = false
            startPage.style.display = "block"
            window.cancelAnimationFrame(canvasID)
            for (const player in players) {
                players[player].score = 0
            }
            init()
        } else {
            if (playingC >= 1) {
                achtung.gameEnded = false
                achtung.gameRunning = false
                init()
            }
        }
    }
    function sendSpace(){
      ws.send(new Uint8Array([0,0,0,1]) )
    }
    if(shouldSendSpace)sendSpace()
}

function drawPlayerDot(opacity, blueDot, size, x, y){
  ctxDO.fillStyle= ( blueDot ? "rgba(0,0,255," : "rgba(255,255,0," ) + opacity + ")"
  ctxDO.beginPath()
  ctxDO.arc(x * h, y * h, size * 0.5 * h, 0, d2r(360), true)
  ctxDO.fill()
}

function drawTrace(player, size, fromX, fromY, toX, toY){
  ctxTH.strokeStyle = players[player].color
  ctxTH.lineWidth = size*h
  ctxTH.beginPath()
  ctxTH.lineCap = "butt"
  ctxTH.moveTo(fromX*h, fromY*h)
  ctxTH.lineTo(toX*h, toY*h)
  ctxTH.stroke()
}

function drawPlayers(view, viewIndex) {
    // clear
    let tFrame=view.getUint32(viewIndex);viewIndex+=4
    let shouldDrawDot=false
    if(tFrame>lastFrame){
      lastFrame=tFrame
      shouldDrawDot=true
    }
    ctxTH.clearRect(h, 0, w - h, h)
    ctxDO.clearRect(0, 0, w, h)
    ctxDO.fillStyle = "#000000"
    ctxDO.fillRect(h, 0, w - h, h)
    borderOpacity=view.getUint8(viewIndex++)/255
    // draw yellow border
    ctxDO.lineWidth = borderWidth*h
    ctxDO.strokeStyle = "#000000"
    ctxDO.strokeRect(borderWidth*h / 2, borderWidth*h / 2, h - borderWidth*h, h - borderWidth*h)
    ctxDO.strokeStyle = "rgba(255,255,0,"+borderOpacity+")"
    ctxDO.strokeRect(borderWidth*h / 2, borderWidth*h / 2, h - borderWidth*h, h - borderWidth*h)
    let nOfPlayers=(view.byteLength-viewIndex)/44
    for(let i=0;i<nOfPlayers;++i){
      let player=playerList[view.getUint8(viewIndex++)]
      let dotOpacity=view.getUint8(viewIndex++) / 255
      let blueDot=view.getUint8(viewIndex++)
      let size=view.getFloat64(viewIndex);viewIndex+=8
      let toX=view.getFloat64(viewIndex);viewIndex+=8
      let toY=view.getFloat64(viewIndex);viewIndex+=8
      // draw dot
      if(shouldDrawDot)drawPlayerDot(dotOpacity, blueDot, size, toX, toY)
      let trace=view.getUint8(viewIndex++)
      if(trace){
        let fromX=view.getFloat64(viewIndex)
        let fromY=view.getFloat64(viewIndex+8)
        drawTrace(player, size, fromX, fromY, toX, toY)
      }
      viewIndex+=16
    }
}

function clearTraces(view, viewIndex){
  ctxTH.clearRect(0, 0, w, h)
}

function removePowup(view, viewIndex){
  achtung.powerupsOnScreen.splice(view.getUint8(viewIndex++), 1)
  powerupDraw()
}

function displayWinner(view, viewIndex){
  let player=playerList[view.getUint8(viewIndex++)]
  ctxUI.fillStyle = players[player].color.replace("rgb", "rgba").replace(")", ", 0.3)")
  ctxUI.fillRect(20 * h100th, 32 * h100th, h - 40 * h100th, h - 64 * h100th)

  ctxUI.lineWidth = borderWidth*h
  ctxUI.strokeStyle = players[player].color
  ctxUI.strokeRect(20 * h100th, 32 * h100th, h - 40 * h100th, h - 64 * h100th)

  ctxUI.textBaseline = "middle"
  ctxUI.fillStyle = players[player].color
  ctxUI.textAlign = "center"
  ctxUI.font = `${w100th * 6}px 'Sarabun'`
  ctxUI.fillText("Konec hry", h / 2, h / 2 - h100th * 5) // the legendary "konec hry"
  ctxUI.font = `${w100th * 4}px 'Sarabun'`
  ctxUI.fillText(`${capitalize(player)} wins!`, h / 2, h / 2 + h100th * 5)
}

// updates points for players
// kills given player and updates points for others
function updateScore(view, viewIndex) {
  //updateScore
  for(let player of playerList){
    players[player].score=view.getInt32(viewIndex);viewIndex+=4
  }
  drawGameUI()
}

// draws game ui
const drawGameUI = () => {
    ctxUI.textBaseline = "alphabetic"
    ctxUI.clearRect(h, 0, w - h, h)
    ctxUI.fillStyle = "#000000"
    ctxUI.fillRect(h, 0, w - h, h)

    // sort players
    achtung.scoreArray = []
    for (const player in players) {
        if (!players[player].ready) continue
        achtung.scoreArray.push([player, players[player].score])
    }
    achtung.scoreArray.sort((a, b) => a[1] - b[1])

    // draw top text
    achtung.pointGoal = Math.max(achtung.scoreArray.length - 1, 1) * 10 // // // // // // // change back to * 10 -------------------------------------------------------------------------------------
    let UIcenter = +h + (w - h) / 2
    ctxUI.fillStyle = "#FFFFFF"
    ctxUI.textAlign = "center"
    ctxUI.letterSpacing = `${w100th * 0.06}px`
    ctxUI.font = `${w100th * 3}px 'Sarabun'`
    ctxUI.fillText("Race to", UIcenter, w100th * 5)
    ctxUI.font = `${w100th * 12}px 'Sarabun'`
    ctxUI.fillText(achtung.pointGoal, UIcenter, w100th * 15)
    ctxUI.font = `${w100th * 2}px 'Sarabun'`
    ctxUI.fillText("2 point difference", UIcenter, w100th * 19)

    // draw player names and score
    ctxUI.font = `${w100th * 3}px 'Sarabun'`
    let playerYOffset = w100th * 32

    for (let i = achtung.scoreArray.length - 1; i >= 0; i--) {
        let p = achtung.scoreArray[i][0]
        ctxUI.fillStyle = players[p].color
        ctxUI.textAlign = "start"
        ctxUI.fillText(capitalize(p), +h + w100th * 2, playerYOffset)
        ctxUI.textAlign = "end"
        ctxUI.fillText(players[p].score, +w - w100th * 2, playerYOffset)
        playerYOffset += w100th * 5
    }

    // draw space to continue text
    ctxUI.fillStyle = "#FFFFFF"
    ctxUI.textAlign = "center"
    ctxUI.font = `${w100th * 2}px 'Sarabun'`
    ctxUI.fillText("SPACE to play", UIcenter, +h - w100th * 6)
    ctxUI.fillText("ESCAPE to quit", UIcenter, +h - w100th * 3)

}

function addPowup(view, viewIndex) {
    achtung.powerupsOnScreen[achtung.powerupsOnScreen.length] = {}
    achtung.powerupsOnScreen[achtung.powerupsOnScreen.length - 1].pow = achtung.powerups[view.getUint8(viewIndex++)]
    achtung.powerupsOnScreen[achtung.powerupsOnScreen.length - 1].xPos = view.getFloat64(viewIndex);viewIndex+=8
    achtung.powerupsOnScreen[achtung.powerupsOnScreen.length - 1].yPos = view.getFloat64(viewIndex);viewIndex+=8
    powerupDraw()
}

// draws powerups to canvas
function powerupDraw() {
    ctxPV.clearRect(0, 0, w, h)

    for (let i = 0; i < achtung.powerupsOnScreen.length; i++) {
        if (achtung.powerupsOnScreen[i] == 0) continue

        let pow = achtung.powerupsOnScreen[i].pow,
            spawnX = achtung.powerupsOnScreen[i].xPos*h,
            spawnY = achtung.powerupsOnScreen[i].yPos*h

        let greenGrad = ctxPV.createRadialGradient(0, 0, 0, 0, 0, iconSizePx)
        greenGrad.addColorStop(0, green)
        greenGrad.addColorStop(1, greent)
        let redGrad = ctxPV.createRadialGradient(0, 0, 0, 0, 0, iconSizePx)
        redGrad.addColorStop(0, red)
        redGrad.addColorStop(1, redt)
        let blueGrad = ctxPV.createRadialGradient(0, 0, 0, 0, 0, iconSizePx)
        blueGrad.addColorStop(0, blue)
        blueGrad.addColorStop(1, bluet)

        ctxPV.save()
        ctxPV.translate(spawnX, spawnY)

        ctxPV.fillStyle = "#000000"
        ctxPV.beginPath()
        ctxPV.arc(0, 0, iconSizePx, 0, d2r(360), false)
        ctxPV.fill()

        if (pow.charAt(0) == "g") {
            ctxPV.strokeStyle = green
            ctxPV.fillStyle = greenGrad
        }
        if (pow.charAt(0) == "r") {
            ctxPV.strokeStyle = red
            ctxPV.fillStyle = redGrad
        }
        if (pow.charAt(0) == "b") {
            ctxPV.strokeStyle = blue
            ctxPV.fillStyle = blueGrad
        }
        if (pow.charAt(0) == "g" || pow.charAt(0) == "r" || pow.charAt(0) == "b") {
            // draw bg
            ctxPV.beginPath()
            ctxPV.arc(0, 0, iconSizePx, 0, d2r(360), false)
            ctxPV.stroke()
            ctxPV.beginPath()
            ctxPV.arc(0, 0, iconSizePx, 0, d2r(360), false)
            ctxPV.fill()
        } else {
            // draw random bg
            ctxPV.strokeStyle = blue
            ctxPV.beginPath()
            ctxPV.arc(0, 0, iconSizePx, 0, d2r(360), false)
            ctxPV.stroke()

            let line1 = [-65, -200]
            let line2 = [-15, -250]

            // draw blue section of bg
            ctxPV.beginPath()
            ctxPV.fillStyle = blueGrad
            ctxPV.arc(0, 0, iconSizePx, d2r(line1[0]), d2r(line1[1]), true)
            ctxPV.moveTo(Math.cos(d2r(line1[1])) * iconSizePx, Math.sin(d2r(line1[1])) * iconSizePx)
            ctxPV.lineTo(Math.cos(d2r(line1[0])) * iconSizePx, Math.sin(d2r(line1[0])) * iconSizePx)
            ctxPV.fill()

            // draw red section of bg
            ctxPV.beginPath()
            ctxPV.fillStyle = redGrad
            ctxPV.arc(0, 0, iconSizePx, d2r(line2[0]), d2r(line1[0]), true)
            ctxPV.moveTo(Math.cos(d2r(line1[0])) * iconSizePx, Math.sin(d2r(line1[0])) * iconSizePx)
            ctxPV.lineTo(Math.cos(d2r(line1[1])) * iconSizePx, Math.sin(d2r(line1[1])) * iconSizePx)
            ctxPV.arc(0, 0, iconSizePx, d2r(line1[1]), d2r(line2[1]), true)
            ctxPV.lineTo(Math.cos(d2r(line2[0])) * iconSizePx, Math.sin(d2r(line2[0])) * iconSizePx)
            ctxPV.fill()

            // draw green section of bg
            ctxPV.beginPath()
            ctxPV.fillStyle = greenGrad
            ctxPV.arc(0, 0, iconSizePx, d2r(line2[1]), d2r(line2[0]), true)
            ctxPV.moveTo(Math.cos(d2r(line2[0])) * iconSizePx, Math.sin(d2r(line2[0])) * iconSizePx)
            ctxPV.lineTo(Math.cos(d2r(line2[1])) * iconSizePx, Math.sin(d2r(line2[1])) * iconSizePx)
            ctxPV.fill()
        }

        // draw yellow icon
        drawPowerupIcons(pow.slice(2))

        ctxPV.restore()
    }
}

// capitalize string
const capitalize = (s) => (typeof s === "string" ? s.charAt(0).toUpperCase() + s.slice(1) : "")

// returns n rounded to .00
const round100 = (n) => Math.round(n * 100) / 100

// returns n round mathCos and mathSin
const mathCos = (n) => round100(Math.cos(n))
const mathSin = (n) => round100(Math.sin(n))

// returns pixel index for alpha value in raw pixel data string
const getAlphaIndexForCoord = (x, y, width) => y * (width * 4) + x * 4 + 3

// returns radians from degree input
const d2r = (deg) => Math.PI / 180 * deg

// returns random int from 0 to n
const calcRandomInt = (int) => Math.floor(Math.random() * int)

// returns n mapped from start1-stop1 to start2-stop2
const map = (n, start1, stop1, start2, stop2) => ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2

newSize() //  calc initial values
init() //  start init

//websocket code
let msgActions=[]
msgActions[128]=drawPlayers
msgActions[129]=updateScore
msgActions[130]=clearTraces
msgActions[131]=addPowup
msgActions[132]=removePowup
msgActions[133]=displayWinner
msgActions[134]=init
msgActions[135]=readyPlayersAndScore
msgActions[136]=addPlayer
msgActions[137]=removePlayer

let ws=new WebSocket("ws://"+location.hostname+":80")
ws.binaryType="arraybuffer"
ws.addEventListener("message", function(event){
  let view=new DataView(event.data)
  if(view.byteLength<1)return
  let action=msgActions[view.getUint8(0)]
  if(action)action(view, 1) //execute action based on msg nr
})

ws.addEventListener("open", function(event){
  ws.send(new Uint8Array([3]) ) // ask for ready players and score
})