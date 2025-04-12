//server code
let gameReady=false
function sendMsg(data) { 
  wss.clients.forEach(client => {
     if (client.readyState === WebSocket.OPEN) {
       //console.log(`distributing message: ${data}`)
       client.send(data)
     }
  })
}

let msgActions=[]
msgActions[0]=keyAction
msgActions[1]=addPlayer
msgActions[2]=removePlayer
msgActions[3]=sendReadyPlayersAndScore

function sendReadyPlayersAndScore(msgView, msgViewIndex, ws){
  let buffer=new ArrayBuffer(1+playerList.length*5),
  view=new DataView(buffer),
  viewIndex=0
  view.setUint8(viewIndex++, 135)
  for(let player of playerList){
    view.setUint8(viewIndex++, players[player].ready ? 1 : 0 )
    view.setInt32(viewIndex, players[player].score);viewIndex+=4
  }
  if (ws.readyState === WebSocket.OPEN) ws.send(buffer)
}

function keyAction(view, viewIndex){
  let player=playerList[view.getUint8(viewIndex++)]
  if(!player)return
  let key=view.getUint8(viewIndex++)
  let pressed=view.getUint8(viewIndex++) ? true : false
  if(key==0 && pressed)pressSpace()
  if(key==1)players[player].turnL=pressed
  if(key==2)players[player].turnR=pressed
}

function addPlayer(view, viewIndex){
  let playerIndex=view.getUint8(viewIndex++), player=playerList[playerIndex]
  if(!player)return
  players[player].ready=true
  sendMsg(new Uint8Array([136,playerIndex] ) )
  sendScore()
}

function removePlayer(view, viewIndex){
  let playerIndex=view.getUint8(viewIndex++), player=playerList[playerIndex]
  if(!player)return
  players[player].ready=false
  sendMsg(new Uint8Array([137,playerIndex] ) )
  sendScore()
}

const express = require('express')
const webserver = express()
 .use((req, res) =>
   res.sendFile(req.path, { root: __dirname })
 )
 .listen(80, () => console.log(`Listening on ${80}`))
const { WebSocketServer } = require('ws')
const wss = new WebSocketServer({ server: webserver })
wss.on('connection', (ws, req) => {
 ws.binaryType="arraybuffer"
 var msg='New client connected: '+req.socket.remoteAddress
 console.log(msg)
 ws.on('close', () => console.log('Client has disconnected: '+req.socket.remoteAddress) )
 ws.on('message', (data, isBinary) => {
   if(!gameReady)return
   if(!isBinary)return
   let view=new DataView(data)
   if(view.byteLength<1)return
   let action=msgActions[view.getUint8(0)]
   if(action)action(view, 1, ws) //execute action based on msg nr
 })
 ws.onerror = function () {
   console.log('websocket error')
 }
})

//game code
/*
messages: 
Sent from client to server:
0: keyAction: Uint8: playerNr, Uint8: keyNr (0:space, 1:left, 2:right, 3:escape), action (0 - release, 1 - press)
1: addPlayer: Uint8: playerNr
2: removePlayer: Uint8: playerNr
3: sendReadyPlayersAndScore: for every player: Uint8: playerNr, Int32: score
Sent from server to client:
128: drawPlayers: Uint32: tFrame, Uint8: borderOpacity(0-255), for every player: Uint8: playerNr, dotOpacity(0-255), blueDot(0 or 1), Float64: size, toX, toY, Uint8: trace(0 or 1), Float64: fromX, fromY
129: updateScore: Int32: score0, score1, score2, score3, score4, score5
130: clearTraces
131: addPowup: Uint8: powupNr, Float64: posX, posY
132: removePowup: Uint8: powupOnScreenIndex
133: displayWinner: Uint8: playerNr
134: init
135: readyPlayersAndScore: for every player: Uint8: ready, Int32: score
136: addPlayer: Uint8: playerNr
137: removePlayer: Uint8: playerNr
*/
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
    gamemode: 1, //  0 = arcade, 1 = classic
    startScreen: false, // are we on the start screen?
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
let intervalHandle,
    tFrame = 0, // cur frame in draw
    powerupProb = 0.005, // in rangle 0 to 1
    bridgeProb = 0.005, // in range 0 to 1
    bridgeSize = 10, // in frames
    turnSpeed = 0.06, // in radians per frame
    moveSpeed,
    playerSize,
    hitboxSize,
    borderWidth,
    iconSize, // to be set in newSize()
    normalFrameTime=(16+2/3), //in ms
    targetDelay=1000/30, //in ms (30 fps)
    lastTime,
    traces=[],
    dpBuffer,
    dpView,
    dpViewIndex,
    dpPlayerIndex

function newSize() {
    // update canvas sizes and variable sizes to fit new size
    moveSpeed = 0.0018*4/3 // in part of field height per frame
    playerSize = 0.007*4/3 // in part of field height
    hitboxSize = playerSize / 1.8 // in part of field height
    borderWidth = 0.005*4/3 // in part of field height
    iconSize = 0.02*4/3 // in part of field height
    drawGameUI()
    //init() // restart
}

function init() {
    sendMsg(new Uint8Array([134] ) )
    lastTime=undefined
    tFrame=0
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

    calcRandomStartPos() // calc random start positions
    calcRandomStartDir() // calc random start directions
    drawStart() // draw players at start so they can see where they're going
}

function pressSpace() {
    let playingC = 0
    for (const player in players) {
        if (players[player].ready) playingC++
    }

    if (achtung.startScreen) {
        if (playingC >= 1) {
            // start game
            achtung.startScreen = false
            achtung.gameEnded = true
            init()
        }
    }

  function pauseGame(){
    // pause game
    achtung.gameRunning = false
    lastTime=undefined
  }
console.log("ended: "+achtung.gameEnded+", running: "+achtung.gameRunning)
    if (!achtung.gameEnded) {
        if (!achtung.gameRunning) {
            // resume game
            lastTime=undefined
            achtung.gameRunning = true
            setImmediate(draw)
        } else {
          pauseGame()
        }
    } else {
        // restart game
        if (achtung.winner) {
            achtung.winner = false
            achtung.gameEnded = true
            pauseGame()
            for (const player in players) {
                players[player].score = 0
            }
            sendScore()
          }
          if (playingC >= 1) {
            achtung.gameEnded = false
            achtung.gameRunning = false
            init()
          }
    }
}

let dpMsgInitialSize=6,
msgForEveryPlayerSize=44

function initDpView(){
    dpPlayerIndex=0
    let playingCount=0
    for (const player in players) {
        if (players[player].ready) playingCount++
    }
    dpBuffer=new ArrayBuffer(dpMsgInitialSize+msgForEveryPlayerSize*playingCount)
    dpView=new DataView(dpBuffer)
    dpViewIndex=0
    dpView.setUint8(dpViewIndex++, 128)

}

// draw start position so players know where they're going
function drawStart() {
    initDpView()
    dpView.setUint32(dpViewIndex, tFrame);dpViewIndex+=4
    dpView.setUint8(dpViewIndex++, 255) // borderOpacity
    for (const player in players) {
        if (!players[player].ready) continue
        dpView.setUint8(dpViewIndex++, playerList.indexOf(player) )
        drawPlayerDot(player, players[player].x, players[player].y)
        drawTrace(player, players[player].x-mathCos(players[player].dir)*playerSize*3, players[player].y-mathSin(players[player].dir)*playerSize*3, players[player].x, players[player].y)
    }
    sendMsg(dpBuffer)
}

function pulsingOpacity(){
  return Math.round((Math.abs((tFrame % 40) - 20) / 20)*255) // 0 - 255
}

function getSize(player){
  return playerSize * players[player].powerup.size
}
// always call drawPlayerDot first, otherwise the message will break
function drawPlayerDot(player, x, y){
  let dotOpacity=255,blueDot=0
  if(players[player].alive){
    if(players[player].powerup.side)dotOpacity=pulsingOpacity()
    if(players[player].powerup.reverse)blueDot=1
  }
  dpView.setUint8(dpViewIndex++, dotOpacity)
  dpView.setUint8(dpViewIndex++, blueDot)
  dpView.setFloat64(dpViewIndex, getSize(player));dpViewIndex+=8
  dpView.setFloat64(dpViewIndex, x);dpViewIndex+=8
  dpView.setFloat64(dpViewIndex, y);dpViewIndex+=8
}
// then call drawTrace
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
  dpViewIndex-=16 // go back by 2 Float64
  //rewrite toX and toY
  dpView.setFloat64(dpViewIndex, toX);dpViewIndex+=8
  dpView.setFloat64(dpViewIndex, toY);dpViewIndex+=8
  dpView.setUint8(dpViewIndex++, 1)
  dpView.setFloat64(dpViewIndex, fromX);dpViewIndex+=8
  dpView.setFloat64(dpViewIndex, fromY);dpViewIndex+=8
}

// main loop
function draw() {
    if(!achtung.gameRunning || achtung.gameEnded || achtung.winner)return
    let timestamp=Number(process.hrtime.bigint())/1000000
    if (lastTime === undefined) lastTime = timestamp;
    const elapsed = timestamp - lastTime
    if (elapsed < targetDelay){
      if(targetDelay-elapsed < 16)setImmediate(draw)
      else setTimeout(draw, 16)
      return
    }
    lastTime = timestamp;
    const timeMult = Math.min(elapsed / normalFrameTime, 6)
    //console.log(timeMult)
    ++tFrame // increment tFrame

    // spawn new powerup if arcade mode and math.random() < powerup probability
    if (achtung.gamemode == 1) if (Math.random() < multProb(powerupProb,timeMult)) powerupSpawner()
    initDpView()
    dpView.setUint32(dpViewIndex, tFrame);dpViewIndex+=4
    let borderOpacity=255
    if(achtung.sides)borderOpacity=pulsingOpacity()
    dpView.setUint8(dpViewIndex++, borderOpacity)
    // loop through players and draw them
    for (const player in players) {
        if (!players[player].ready) continue // continue loop if player not playing
        dpViewIndex=dpMsgInitialSize+dpPlayerIndex*msgForEveryPlayerSize
        ++dpPlayerIndex //needs to be incremented here, otherwise it won't update if player dies
        dpView.setUint8(dpViewIndex++, playerList.indexOf(player) )
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
        // draw dot
        drawPlayerDot(player, nextPosX, nextPosY)
        if (!players[player].alive) continue // continue if player not alive (drawing dot is above, so player dot will still be drawn even if dead)

        // update player turning
        let currentTurnSpeed=turnSpeed * timeMult / Math.pow(players[player].powerup.size, 0.3), toTurn=0
        if(players[player].turnL)toTurn-=currentTurnSpeed
        if(players[player].turnR)toTurn+=currentTurnSpeed
        if(players[player].powerup.reverse)toTurn= -toTurn
        players[player].dir+=toTurn

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
        if (timestamp > players[player].bridgeTime + bridgeSize*normalFrameTime*players[player].powerup.size / players[player].powerup.speed) {
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

                // send remove powerup message
                let buffer=new ArrayBuffer(2),
                view=new DataView(buffer),
                viewIndex=0
                view.setUint8(viewIndex++, 132)
                view.setUint8(viewIndex++, i)
                sendMsg(buffer)
                // do powerup
                doPowerups(player, players[player].powerup.powerupArray.length - 1)
            }
        }
    }
    sendMsg(dpBuffer)
    // drawGameUI()
    checkGameState()
    if(!achtung.gameRunning || achtung.gameEnded || achtung.winner)return
    setImmediate(draw)
}

function sendScore(){
  let buffer=new ArrayBuffer(1+4*playerList.length),
  view=new DataView(buffer),
  viewIndex=0
  view.setUint8(viewIndex++, 129)
  for(let player of playerList){
    view.setInt32(viewIndex, players[player].score);viewIndex+=4
  }
  sendMsg(buffer)
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
        achtung.gameEnded = true
    }

    // did someone win?
    if (achtung.gameEnded && achtung.scoreArray.length>=1) {
        if (achtung.scoreArray[achtung.scoreArray.length - 1][1] >= achtung.pointGoal) {
            if (achtung.scoreArray[achtung.scoreArray.length - 1][1] - achtung.scoreArray[achtung.scoreArray.length - 2][1] > 1) {
                let player = achtung.scoreArray[achtung.scoreArray.length - 1][0]
                console.log(player + " wins the game")
                achtung.winner = true
                // send display winner message
                sendMsg(new Uint8Array([133,playerList.indexOf(player)] ) )
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
    sendScore()
}

// sorts score
const drawGameUI = () => {
    // sort players
    achtung.scoreArray = []
    for (const player in players) {
        if (!players[player].ready) continue
        achtung.scoreArray.push([player, players[player].score])
    }
    achtung.scoreArray.sort((a, b) => a[1] - b[1])
    achtung.pointGoal = Math.max(achtung.scoreArray.length - 1, 1) * 10
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
        let buffer=new ArrayBuffer(2),
        view=new DataView(buffer)
        view.setUint8(0, 130)
        sendMsg(buffer)
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
    let newPowIndex = Math.floor(Math.random() * achtung.powerups.length),
        spawnX = Math.random(),
        spawnY = Math.random(),
        powup = achtung.powerups[newPowIndex]

    achtung.powerupsOnScreen[achtung.powerupsOnScreen.length] = {}
    achtung.powerupsOnScreen[achtung.powerupsOnScreen.length - 1].pow = powup
    achtung.powerupsOnScreen[achtung.powerupsOnScreen.length - 1].xPos = spawnX
    achtung.powerupsOnScreen[achtung.powerupsOnScreen.length - 1].yPos = spawnY

    // send add powerup message
    let buffer=new ArrayBuffer(18),
    view=new DataView(buffer),
    viewIndex=0
    view.setUint8(viewIndex++, 131)
    view.setUint8(viewIndex++, newPowIndex)
    view.setFloat64(viewIndex, spawnX);viewIndex+=8
    view.setFloat64(viewIndex, spawnY);viewIndex+=8
    sendMsg(buffer)
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

// returns radians from degree input
const d2r = (deg) => Math.PI / 180 * deg

// returns random int from 0 to n
const calcRandomInt = (int) => Math.floor(Math.random() * int)

// returns n mapped from start1-stop1 to start2-stop2
const map = (n, start1, stop1, start2, stop2) => ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2

newSize() //  calc initial values
init() //  start init
gameReady=true
