function multProb(prob, mult){
  //multipleies probability
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

let achtung = {
    gamemode: 1, //  0 = arcade, 1 = classic
    startScreen: true, // are we on the start screen?
    gameRunning: false, // are we playing?
    gameEnded: true, // are noone alive?
    winner: false, // do we have a winner?
    sides: 0, // can all players go out of screen and come out the other side
    clearSides: 0, // to clear timeone if leftover time from last round
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
    tFrame = 0, // cur frame in draw
    powerupProb = 0.005, // in rangle 0 to 1
    bridgeProb = 0.005, // in range 0 to 1
    bridgeSize = 10, // in frames
    turnSpeed = 0.06, // in radians per frame
    w,
    h,
    w100th,
    h100th,
    moveSpeed,
    playerSize,
    hitboxSize,
    borderWidth,
    iconSize,
    iconSizePx, // to be set in newSize()
    normalFrameTime=16+2/3, //in ms
    lastTime,
    traces=[]

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
    moveSpeed = 0.0018*w/h // in part of field height per frame
    playerSize = 0.007*w/h // in part of field height
    hitboxSize = playerSize / 1.8 // in part of field height
    borderWidth = 0.005*w/h // in part of field height
    iconSize = 0.02*w/h // in part of field height
    iconSizePx = iconSize*h // in pixels
    drawGameUI()
    powerupDraw()
    //init() // restart
}

function init() {
    lastTime=undefined
    traces=[]
    achtung.powerupsOnScreen = [] // clear powerups on screen
    clearTimeout(achtung.clearSides) // clear timeout if sides powerup leftover time from last round
    achtung.sides = 0 // reset sides

    for (const player in players) {
        // clear timeout if powerup leftover time from last round
        for (let i = 0; i < players[player].powerup.toClear.length; i++) {
            clearTimeout(players[player].powerup.toClear[i])
        }

        // reset players object to default values before starting a new round
        players[player].x = 0
        players[player].y = 0
        players[player].dir = 0
        players[player].turnL = false
        players[player].turnR = false
        players[player].color = getComputedStyle(document.documentElement).getPropertyValue(`--${player}`) // colors from css :root object
        players[player].alive = true
        players[player].winner = false
        players[player].bridge = false
        players[player].bridgeTime = 0
        players[player].powerup = {} // contains powerup values
        players[player].powerup.size = 1
        players[player].powerup.robot = 0
        players[player].powerup.reverse = 0
        players[player].powerup.speed = 1
        players[player].powerup.invisible = 0
        players[player].powerup.side = 0
        players[player].powerup.powerupArray = []
        players[player].powerup.toClear = [] // to clear timeout at the end of rounds if leftover time
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

    calcRandomStartPos() // calc random start positions
    calcRandomStartDir() // calc random start directions
    drawGameUI() // draw ui
    drawStart() // draw players at start so they can see where they're going
}

document.addEventListener("keydown", (e) => {
    // update players turning to true if turning
    for (const player in players) {
        if (!players[player].alive) continue // if player not alive; skip
        if (e.code == players[player].keyL) {
            players[player].turnL = true
        }
        if (e.code == players[player].keyR) {
            players[player].turnR = true
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
})
document.addEventListener("keyup", (e) => {
    // update players turning to false when keyup
    for (const player in players) {
        if (!players[player].alive) continue // if player not alive; skip
        if (e.code == players[player].keyL) {
            players[player].turnL = false
        }
        if (e.code == players[player].keyR) {
            players[player].turnR = false
        }
    }
})
document.addEventListener("keypress", (e) => {
    if (e.code == "Space") {
        pressSpace()
    }
})

function pressSpace() {
    let playingC = 0
    for (const player in players) {
        if (players[player].ready) playingC++
    }

    if (achtung.startScreen) {
        if (playingC >= 1) {
            // start game
            for (const player in players) {
                if (players[player].active && !players[player].ready) {
                    resetPlayer(document.querySelector(`.player_wrapper.${player}`))
                }
            }
            achtung.startScreen = false
            achtung.gameEnded = true
            startPage.style.display = "none"
            init()
        }
    }

    if (!achtung.gameEnded) {
        if (!achtung.gameRunning) {
            // resume game
            lastTime=undefined
            achtung.gameRunning = true
            window.requestAnimationFrame(draw)
        } else {
            // pause game
            achtung.gameRunning = false
            window.cancelAnimationFrame(canvasID)
            lastTime=undefined
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
}

// draw start position so players know where they're going
function drawStart() {
    for (const player in players) {
        if (!players[player].ready) continue
        ctxDO.fillStyle = yellow
        drawPlayerDot(player, players[player].x, players[player].y)
        drawTrace(player, players[player].x-mathCos(players[player].dir)*playerSize*3, players[player].y-mathSin(players[player].dir)*playerSize*3, players[player].x, players[player].y)
    }
}

function drawPlayerDot(player, x, y){
  ctxDO.beginPath()
  ctxDO.arc(x * h, y * h, playerSize * 0.5 * players[player].powerup.size * h, 0, d2r(360), true)
  ctxDO.fill()
}

function drawTrace(player, fromX, fromY, toX, toY){
  //players[player].dir must be correct for given X and Y, this function doesn't calculate it
  let currentWidth=playerSize * players[player].powerup.size,
  cornerX=fromX+0.5*currentWidth*Math.sin(players[player].dir),
  cornerY=fromY-0.5*currentWidth*Math.cos(players[player].dir)
  // x , y of trace rectange corner,  width, height, rotation angle
  traces.push([
    cornerX,
    cornerY,
    Math.sqrt(Math.pow(toX-fromX,2)+Math.pow(toY-fromY,2)),
    currentWidth,
    players[player].dir
  ])
  ctxTH.strokeStyle = players[player].color
  ctxTH.lineWidth = currentWidth*h
  ctxTH.beginPath()
  ctxTH.lineCap = "butt"
  ctxTH.moveTo(fromX*h, fromY*h)
  ctxTH.lineTo(toX*h, toY*h)
  ctxTH.stroke()
  
}

// main loop
function draw(timestamp) {
    canvasID = window.requestAnimationFrame(draw) // to pause: cancelAnimationFrame(CanvasID)
    tFrame++ // increment tFrame
    if (lastTime === undefined) lastTime = timestamp;
    const elapsed = Math.min(timestamp - lastTime,100), timeMult = elapsed / normalFrameTime;
    lastTime = timestamp;
    // clear
    ctxTH.clearRect(h, 0, w - h, h)
    ctxDO.clearRect(0, 0, w, h)
    ctxDO.fillStyle = "#000000"
    ctxDO.fillRect(h, 0, w - h, h)

    // draw yellow border
    ctxDO.lineWidth = borderWidth*h
    ctxDO.strokeStyle = "#000000"
    ctxDO.strokeRect(borderWidth*h / 2, borderWidth*h / 2, h - borderWidth*h, h - borderWidth*h)
    if (achtung.sides != 0) ctxDO.strokeStyle = `rgba(255, 255, 0, ${Math.abs((tFrame % 40) - 20) / 20})`
    else ctxDO.strokeStyle = yellow // if sides, border flickers
    ctxDO.strokeRect(borderWidth*h / 2, borderWidth*h / 2, h - borderWidth*h, h - borderWidth*h)

    // spawn new powerup if arcade mode and math.random() < powerup probability
    if (achtung.gamemode == 1) if (Math.random() < multProb(powerupProb,timeMult)) powerupSpawner()

    // loop through players and draw them
    for (const player in players) {
        if (!players[player].ready) continue // continue loop if player not playing

        // player pos
        let prevprevPosX = players[player].x - mathCos(players[player].dir) * moveSpeed * players[player].powerup.speed * timeMult,
            prevprevPosY = players[player].y - mathSin(players[player].dir) * moveSpeed * players[player].powerup.speed * timeMult,
            prevPosX = players[player].x,
            prevPosY = players[player].y,
            nextPosX = players[player].x,
            nextPosY = players[player].y
        if(players[player].alive){
          nextPosX+=mathCos(players[player].dir) * moveSpeed * players[player].powerup.speed * timeMult
          nextPosY+=mathSin(players[player].dir) * moveSpeed * players[player].powerup.speed * timeMult
        }
        // draw player dot
        if (players[player].powerup.reverse == 0) {
            if (players[player].powerup.side == 0) {
                ctxDO.fillStyle = yellow
            } else ctxDO.fillStyle = `rgba(255, 255, 0, ${Math.abs((tFrame % 40) - 20) / 20})` // flicker dot if side powerup
        } else {
            if (players[player].powerup.side == 0) {
                ctxDO.fillStyle = blue
            } else ctxDO.fillStyle = `rgba(0, 0, 255, ${Math.abs((tFrame % 40) - 20) / 20})` // flicker dot if side powerup
        }
        // draw dot
        drawPlayerDot(player, nextPosX, nextPosY)

        if (!players[player].alive) continue // continue if player not alive (drawing dot is above, so player dot will still be drawn even if dead)

        // update player turning
        if (players[player].powerup.robot == 0) {
            // if normal
            if (players[player].turnL) {
                if (players[player].powerup.reverse == 0) players[player].dir -= turnSpeed * timeMult / Math.pow(players[player].powerup.size, 0.3)
                else players[player].dir += turnSpeed * timeMult / Math.pow(players[player].powerup.size, 0.3)
            }
            if (players[player].turnR) {
                if (players[player].powerup.reverse == 0) players[player].dir += turnSpeed * timeMult / Math.pow(players[player].powerup.size, 0.3)
                else players[player].dir -= turnSpeed * timeMult / Math.pow(players[player].powerup.size, 0.3)
            }
        } else {
            // if robot
            if (players[player].turnL) {
                players[player].turnL = false
                if (players[player].powerup.reverse == 0) players[player].dir -= d2r(90)
                else players[player].dir += d2r(90)
            }
            if (players[player].turnR) {
                players[player].turnR = false
                if (players[player].powerup.reverse == 0) players[player].dir += d2r(90)
                else players[player].dir -= d2r(90)
            }
        }

        // update player position
        prevPosX = players[player].x
        prevPosY = players[player].y
        players[player].x = nextPosX
        players[player].y = nextPosY

        // check for player inside playing field
        if (achtung.sides != 0 || players[player].powerup.side != 0) {
            // player has side powerup of achtung.sides, players can move out of canvas
            if (players[player].x < 0) {
                players[player].x = 1.0
                prevPosX = 1.0
                prevprevPosX = 1.0
            }
            if (players[player].x > 1.0) {
                players[player].x = 0
                prevPosX = 0
                prevprevPosX = 0
            }
            if (players[player].y < 0) {
                players[player].y = 1.0
                prevPosY = 1.0
                prevprevPosY = 1.0
            }
            if (players[player].y > 1.0) {
                players[player].y = 0
                prevPosY = 0
                prevprevPosY = 0
            }
        } else if (
                // if not, player dead
                players[player].x < borderWidth + hitboxSize ||
                players[player].x > 1.0 - borderWidth - hitboxSize ||
                players[player].y < borderWidth + hitboxSize ||
                players[player].y > 1.0 - borderWidth - hitboxSize
            ) {
                givePoints(players[player])
                continue
        }

        // insert bridge
        if (!players[player].bridge) {
            // if not already bridge
            if (Math.random() < multProb(bridgeProb,timeMult)) {
                // if math.random() less than prob for bridge
                players[player].bridge = true
            }
            players[player].bridgeTime = timestamp // what frame did bridge start
        }
        if (players[player].bridgeTime < timestamp - normalFrameTime*((bridgeSize / players[player].powerup.speed) * players[player].powerup.size)) {
            // stop bridge when bridgeSize frame has passed
            players[player].bridge = false
        }

        // draw player trace; don't draw if bridge or invisible
        if (!players[player].bridge && players[player].powerup.invisible == 0) {
            drawTrace(player, prevprevPosX, prevprevPosY, players[player].x, players[player].y)
        }

        // check collision
        const frontX = players[player].x + Math.cos(players[player].dir) * hitboxSize * players[player].powerup.size
        const frontY = players[player].y + Math.sin(players[player].dir) * hitboxSize * players[player].powerup.size
        const leftX = players[player].x + Math.cos(players[player].dir - d2r(55)) * hitboxSize * players[player].powerup.size
        const leftY = players[player].y + Math.sin(players[player].dir - d2r(55)) * hitboxSize * players[player].powerup.size
        const rightX = players[player].x + Math.cos(players[player].dir + d2r(55)) * hitboxSize * players[player].powerup.size
        const rightY = players[player].y + Math.sin(players[player].dir + d2r(55)) * hitboxSize * players[player].powerup.size
        let hitboxPoints=[ [frontX,frontY], [leftX,leftY], [rightX,rightY] ]
        //draw hitbox points
        for(let i=0;i<hitboxPoints.length;++i){
          ctxDO.beginPath()
          ctxDO.arc(hitboxPoints[i][0]*h,hitboxPoints[i][1]*h,1,0,Math.PI*2)
          ctxDO.fill()
        }
        if (!players[player].bridge && players[player].powerup.invisible == 0) {
            // check collision only if not making bridge and not invisible
            function checkCollision(){
              for(let i=traces.length-2;i>=0;--i){ // -2 instead of -1 is to skip the last trace
                for(let j=0;j<hitboxPoints.length;++j){
                  let rotatedPoint=rotatePoint( [ traces[i][0], traces[i][1] ], hitboxPoints[j], -traces[i][4])
                  if( rectPointCollide(rotatedPoint[0], rotatedPoint[1], traces[i][2], traces[i][3], hitboxPoints[j][0], hitboxPoints[j][1]) ){
                    console.log("Collision: "+player+", point "+j+", trace "+i)
                    return true
                  }
                }
              }
              return false
            }
            if(checkCollision()){
              givePoints(players[player])
              continue
            }
        }

        // check collision for every powerup on screen
        for (let i = 0; i < achtung.powerupsOnScreen.length; i++) {
            if (
                // distance between the player and a powerup
                Math.sqrt( 
                Math.pow(players[player].x - achtung.powerupsOnScreen[i].xPos, 2)
                + Math.pow(players[player].y - achtung.powerupsOnScreen[i].yPos, 2)
                )
                // is smaller than radius of the player + radius of a powerup
                < playerSize * players[player].powerup.size * 0.5 + iconSize
            ) {
                let powName = achtung.powerupsOnScreen[i].pow
                players[player].powerup.powerupArray.push(powName)

                // remove powerup from screen
                achtung.powerupsOnScreen.splice(i, 1)

                // do powerup
                doPowerups(player, players[player].powerup.powerupArray.length - 1)

                // draw powerup
                powerupDraw()
            }
        }
    }

    // drawGameUI()
    checkGameState()
}

// check game stats
function checkGameState() {
    // how many are alive?
    let alive = 0
    let ready = 0
    for (const player in players) {
        if (players[player].ready) {
            ready ++
            if (players[player].alive) {
                alive++
            }
        }
    }

    // if all dead
    if ( (alive <= 1 && ready != 1) || alive <= 0) {
        // IMPORTANT - change back to 1 -------------------------------------------------------------------------------------------------------------------------------
        window.cancelAnimationFrame(canvasID)
        achtung.gameEnded = true
    }

    // did someone win?
    if (achtung.gameEnded) {
        if (achtung.scoreArray[achtung.scoreArray.length - 1][1] >= achtung.pointGoal) {
            if (achtung.scoreArray[achtung.scoreArray.length - 1][1] - achtung.scoreArray[achtung.scoreArray.length - 2][1] > 1) {
                let p = achtung.scoreArray[achtung.scoreArray.length - 1][0]
                // console.log(p + " wins the game")
                achtung.winner = true

                // draw winner screen
                for (const player in players) {
                    if (player == p) {
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
                }
            } else {
                // two players are within 1 point; continue playing
                // console.log("play on")
            }
        }
    }
}

// updates points for players
// kills given player and updates points for others
function givePoints(p) {
    p.alive = false
    for (const player in players) {
        if (!players[player].ready) continue
        if (p != players[player] && players[player].alive) {
            players[player].score++
            drawGameUI()
        }
    }
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

// executes powerups
function doPowerups(puPlayer, index) {
    let gTimeout = 8000
    let rTimeout = 5000
    let powName = players[puPlayer].powerup.powerupArray[index]

    // powerup starts
    if (powName == "o_random") {
        let powArray=achtung.powerups.slice();
        powArray.splice(powArray.indexOf("g_die"));
        powName = powArray[Math.floor(Math.random() * powArray.length)]
    }
    if (powName == "g_slow") {
        players[puPlayer].powerup.speed *= 0.5
        players[puPlayer].powerup.toClear[index] = setTimeout(() => (players[puPlayer].powerup.speed *= 2), gTimeout)
    }
    if (powName == "g_fast") {
        players[puPlayer].powerup.speed *= 2
        players[puPlayer].powerup.toClear[index] = setTimeout(() => (players[puPlayer].powerup.speed *= 0.5), gTimeout)
    }
    if (powName == "g_thin") {
        players[puPlayer].powerup.size *= 0.5
        players[puPlayer].powerup.toClear[index] = setTimeout(() => (players[puPlayer].powerup.size *= 2), gTimeout)
    }
    if (powName == "g_robot") {
        players[puPlayer].powerup.robot++
        players[puPlayer].powerup.toClear[index] = setTimeout(() => players[puPlayer].powerup.robot--, gTimeout)
    }
    if (powName == "g_side") {
        players[puPlayer].powerup.side++
        players[puPlayer].powerup.toClear[index] = setTimeout(() => players[puPlayer].powerup.side--, gTimeout)
    }
    if (powName == "g_die") {
        givePoints(players[puPlayer])
    }
    if (powName == "g_invisible") {
        players[puPlayer].powerup.invisible++
        players[puPlayer].powerup.toClear[index] = setTimeout(() => players[puPlayer].powerup.invisible--, gTimeout)
    }
    if (powName == "r_slow") {
        for (const otherPlayers in players) {
            if (otherPlayers != puPlayer) {
                players[otherPlayers].powerup.speed *= 0.5
                players[otherPlayers].powerup.toClear[index] = setTimeout(() => (players[otherPlayers].powerup.speed *= 2), rTimeout)
            }
        }
    }
    if (powName == "r_fast") {
        for (const otherPlayers in players) {
            if (otherPlayers != puPlayer) {
                players[otherPlayers].powerup.speed *= 2
                players[otherPlayers].powerup.toClear[index] = setTimeout(() => (players[otherPlayers].powerup.speed *= 0.5), rTimeout)
            }
        }
    }
    if (powName == "r_thick") {
        for (const otherPlayers in players) {
            if (otherPlayers != puPlayer) {
                players[otherPlayers].powerup.size *= 2
                players[otherPlayers].powerup.toClear[index] = setTimeout(() => (players[otherPlayers].powerup.size *= 0.5), rTimeout)
            }
        }
    }
    if (powName == "r_robot") {
        for (const otherPlayers in players) {
            if (otherPlayers != puPlayer) {
                players[otherPlayers].powerup.robot++
                players[otherPlayers].powerup.toClear[index] = setTimeout(() => players[otherPlayers].powerup.robot--, rTimeout)
            }
        }
    }
    if (powName == "r_reverse") {
        for (const otherPlayers in players) {
            if (otherPlayers != puPlayer) {
                players[otherPlayers].powerup.reverse++
                players[otherPlayers].powerup.toClear[index] = setTimeout(() => players[otherPlayers].powerup.reverse--, rTimeout)
            }
        }
    }
    if (powName == "b_clear") {
        traces=[]
        ctxTH.clearRect(0, 0, h, h)
    }
    if (powName == "b_more") {
        setTimeout(powerupSpawner, 100)
        setTimeout(powerupSpawner, 200)
        setTimeout(powerupSpawner, 300)
    }
    if (powName == "b_sides") {
        achtung.sides++
        achtung.clearSides = setTimeout(() => achtung.sides--, gTimeout)
    }
}

// updates the achtung object with data of a new powerup
function powerupSpawner() {
    if (achtung.powerupsOnScreen.length > 30) return
    let newPow = Math.floor(Math.random() * achtung.powerups.length),
        spawnX = Math.floor(Math.random() * h) / h,
        spawnY = Math.floor(Math.random() * h) / h,
        powup = achtung.powerups[newPow]
     //powup = "g_fast"

    achtung.powerupsOnScreen[achtung.powerupsOnScreen.length] = {}
    achtung.powerupsOnScreen[achtung.powerupsOnScreen.length - 1].pow = powup
    achtung.powerupsOnScreen[achtung.powerupsOnScreen.length - 1].xPos = spawnX
    achtung.powerupsOnScreen[achtung.powerupsOnScreen.length - 1].yPos = spawnY

    // powerupIndex++

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

// calc random start direction
function calcRandomStartDir() {
    for (const player in players) {
        players[player].dir = round100(Math.random() * Math.PI * 2)
    }
}

// calc random start position x and y
function calcRandomStartPos() {
    for (const player in players) {
        players[player].x = map(Math.random(), 0, 1.0, borderWidth * 10, 1.0 - borderWidth * 10) // map to avoid instant death
        players[player].y = map(Math.random(), 0, 1.0, borderWidth * 10, 1.0 - borderWidth * 10) // map to avoid instant death
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
