# Achtung, die Kurve!

Network, modified version of Achtung, die Kurve! by Eigil Nikolajsen hosted on: [https://achtung.life](https://achtung.life)
**run:** node index.js
modified-offline is the offline version of modified game
**Work in progress**

I've changed collision detection to work by checking if a hitbox point is inside a rectangle (traces are saved to array), which improves performance of offline game and makes the network one able to work without a canvas, normalized coordinates to 0 . . . 1, scaled canvas by 2, deleted robot powerup, added a new one that kills the player, and made the game work with only 1 player. Online game is based on Node.js and websockets, and is intended to run on local network. It's not yet finished.

Licence: MIT
