var game;

function startGame(cond=false, v2=undefined){ 
    if(!cond) phase = 0;
    game = new Game(
        cond,
        v2,
        1920, 
        1080, 
        parseInt(document.getElementById("players").value),
        parseInt(document.getElementById("cards").value), 
        [document.getElementById("canvas")]
    ); 
    document.addEventListener('keydown', keyPress, false);
    game.update();
}

var phase = 0; // 0 = set tile, 1 = move player

function saveGame(){
    localStorage.setItem("saved", JSON.stringify(true));
    localStorage.setItem("game", JSON.stringify(game));
    localStorage.setItem("phase", JSON.stringify(phase));
    localStorage.setItem("maxNumItems", JSON.stringify(maxNumItems));
    localStorage.setItem("generatedNumItems", JSON.stringify(generatedNumItems));
    localStorage.setItem("itemColorsByCode", JSON.stringify(itemColorsByCode));
}

function loadGame(){
    phase = JSON.parse(localStorage.getItem("phase"));
    maxNumItems = JSON.parse(localStorage.getItem("maxNumItems"));
    generatedNumItems = JSON.parse(localStorage.getItem("generatedNumItems"));
    itemColorsByCode = JSON.parse(localStorage.getItem("itemColorsByCode"));
    startGame(true, JSON.parse(localStorage.getItem("game")));
}

function resetGameGlobalVariables(){
    document.removeEventListener('keydown', keyPress, false);
    phase = 0;
    maxNumItems = 0;
    generatedNumItems = 0;
    itemColorsByCode = [null];
}

function keyPress(e){
    if(game && !game.finish){
        var yMoved = false;
        var legacyIndex = 0;
        switch(e.key){
            case 'w': legacyIndex = 0; yMoved = true; break;
            case 's': legacyIndex = 2; yMoved = true; break;
            case 'd': legacyIndex = 1; break;
            case 'a': legacyIndex = 3; break;
            case 'e': if(phase == 0) game.rotateCurrentTile(1); break;
            case 'q': if(phase == 0) game.rotateCurrentTile(-1); break;
            case 'Enter':
                if( phase == 0 && game.checkIfPushable(game.currentTilePos)){
                    var forbiddedPos = game.map.pushNewTile(game.currentTile, game.currentTilePos);
                    //console.log("Tile pushed! Pushed tile:", pushedData.lostTile);
                    game.setForbiddedPushTilePos(forbiddedPos);
                    game.drawTileBeforeShift();
                    game.pushPlayersChecker();
                    game.currentTile.changeColor(0);
                    game.generateNewTile();
                    game.searchPaths();
                    phase++;
                }
                else if(phase == 1){
                    game.checkPlayerItem();
                    game.resetPassableTilesPreColors();
                    phase--;
                    game.changeTurn();
                }
                break;
        }
        const moveKeys = ['w', 'a', 's', 'd'];
        if(moveKeys.includes(e.key)){
            if(phase == 0) game.moveCurrentTile(legacyIndex, yMoved);
            else if(phase == 1) game.movePlayer(legacyIndex);
        }
        game.update();
    }
}

class Game{
    map; 
    numPlayers;
    currentCanvas; 
    currentTile; 
    arrowPos; 
    tileSize;
    players;
    playerTurn;
    explorer;
    passableTilesPreColors;
    turn;
    finish;
    winner;
    forbiddedPushTilePos;

    constructor(saved, cond, w, h, numPlayers, numCards, canvases){
         
        //load canvases
        this.canvases = canvases;
        //set width and height for each canvas
        this.canvases.forEach(c => {
            c.width = w;
            c.height = h;
        });
        console.log("canvases set! number of canvas:", canvases.length);
        console.log("width:", w, "height:", h);
        //current canvas is the first one
        this.currentCanvas = 0;

        //legacy. This tells the direction each tiles' pass leads to.
        this.legacy = [new Worker(0, -1), new Worker(1, 0), new Worker(0, 1), new Worker(-1, 0)];

        if(!saved && cond==undefined){
            //initialize game finish condition
            this.finish = false;
            //initialize turn
            this.turn = 1;
            console.log("Turn "+this.turn+"!");
            //setting the max number of item
            maxNumItems = numPlayers*numCards;
            //make new map
            this.map = new Map();
            //load number of players
            this.numPlayers = numPlayers;
            //load number of treasure cards
            this.numCards = numCards;

            //generate new tile for turn 1
            this.generateNewTile();

            //used during player's turn.
            this.passableTilesPreColors = [];

            //spawnpoints for players... players initializations
            this.players = [];
            var spawnPoints = [
                [0, 0, new Color(255, 0, 0, 1), new Color(155, 0, 0, 1)], 
                [0, 6, new Color(0, 255, 0, 1), new Color(0, 155, 0, 1)], 
                [6, 6, new Color(0, 0, 255, 1), new Color(0, 0, 155, 1)], 
                [6, 0, new Color(255, 0, 255 ,1), new Color(155, 0, 155, 1)]
            ];
            //initialzie the cards taken
            var cardsTaken = [];
            for(var i = 0; i < this.numPlayers; i++){
                var temp = spawnPoints[i];
                //setting spawnpoint itemCode and color
                this.map.data[temp[1]][temp[0]].setItem(-1, temp[2]);
                var cards = [];
                for(var cardsDraw = 0; cardsDraw < this.numCards; cardsDraw++){
                    var randomItem;
                    do{ randomItem = getRandom(1, maxNumItems+1); }
                    while(cardsTaken.includes(randomItem))
                    cards.push(randomItem);
                    cardsTaken.push(randomItem);
                }
                this.players.push(new Character(i, new Worker(temp[0], temp[1]), temp[3], cards));
                console.log("players generated!", this.players[i]);
            }
            this.playerTurn = -1;
            this.changeTurn();
            //this.refreshCurrentCard();
        }else{
            cond.map = new Map(true, cond.map);
            cond.players.forEach((v, i) => {
                cond.players[i] = new Character(-1, v);
            });
            const forbidden = ["canvases", "legacy", "arrowPos", "tileSize", "currentCanvas"];
            for(let [key, value] of Object.entries(cond)){
                //"explorer", "currentTilePos", "currentTile"
                if(key == "currentTilePos") this[key] = new Worker(value.x, value.y);
                else if(key == "currentTile") this[key] = new Tile(-1, value);
                else if(key == "explorer") this[key] = new Explorer(-1, value);
                else if(!forbidden.includes(key)) this[key] = value;
            }
        }

        //tilesize initialization and the position map where players can insert new tiles
        const c = this.canvases[this.currentCanvas];
        this.tileSize = c.height/(this.map.data.length+2);
        var size = this.tileSize;
        this.arrowPos = [
            [new Worker(size+size, 0), new Worker(size*3+size, 0), new Worker(size*5+size, 0)],
            [new Worker(0, size+size), new Worker(c.height-size, size+size)],
            [new Worker(0, size*3+size), new Worker(c.height-size, size*3+size)],
            [new Worker(0, size*5+size), new Worker(c.height-size, size*5+size)],
            [new Worker(size+size, c.height-size), new Worker(size*3+size, c.height-size), new Worker(size*5+size, c.height-size)]
        ];
        //this is how it will look like. 0 is replaced with the x and y vectors.
        ///////////////
        //  [0,0,0]  //
        //[0,      0]//
        //[0,      0]//
        //[0,      0]//
        //  [0,0,0]  //
        ///////////////

    }

    update(){
        this.clearCanvas();
        if(!this.finish){
            if(this.getCurrentPlayer().victory){
                console.log("player already won! Skipping to next turn...");
                this.changeTurn();
            }
            if(phase == 1) this.changePassableTileColors();
            this.drawMap();
            if(phase == 0) this.drawCurrentTile();
            if(phase == 1) this.fixPassableTileColors();
            this.drawPlayers();
            this.refreshCurrentCard();
            this.refreshPlayerPoints();
            this.refreshGameInfo();
            this.refreshPlayerPosText();
            this.playersOnItemDrawChecker();
        }else{
            //lead to victory screen
            console.log("player won!");
            ctrlClassOfElementById("apply", "game", "transparent");
            ctrlClassOfElementById("remove", "victory", "transparent");
            var playerWonText = document.getElementById("playerWon");
            var winner = this.getWinner();
            var rgbaWinner = "rgba("+winner.color.r+","+winner.color.g+","+winner.color.b+","+winner.color.a+")";
            playerWonText.innerText = "Player "+(winner.index+1)+" WON!";
            playerWonText.style = "color: "+rgbaWinner;
            
            var totalTurnText = document.getElementById("totalTurns");
            totalTurnText.innerText = this.getTotalTurns();
        }
    }

    finishGame(){
        resetGameGlobalVariables();
        this.finish = true;
        this.winner = this.getCurrentPlayer();
    }

    getWinner(){ return this.winner; }

    getTotalTurns(){ return this.turn; }

    movePlayer(legacyIndex){
        var p = this.players[this.playerTurn];
        var cTile = this.map.data[p.pos.y][p.pos.x];
        var cPath = tileLists[cTile.id][cTile.version];
        var moveAmt = this.legacy[legacyIndex];
        var newPos = new Worker(p.pos.x + moveAmt.x, p.pos.y + moveAmt.y);
        console.log("Player moving!", p, "moving to", newPos);
        console.log("current tile:", cTile, "path of this tile is", cPath);
        console.log("checking if passable...");
        if(newPos.x >= 0 && newPos.x < this.map.maxTileNum && newPos.y >= 0 && newPos.y < this.map.maxTileNum){
            var nextTile = this.map.data[newPos.y][newPos.x];
            var nextPath = tileLists[nextTile.id][nextTile.version];
            var oppositeLegacyIndex = legacyIndex + 2 > 3 ? legacyIndex - 2 : legacyIndex + 2;
            if(cPath[legacyIndex] == 0 && nextPath[oppositeLegacyIndex] == 0){
                console.log("passable! Player moved.", p);
                this.pushPlayer(p, moveAmt);
            }
            else console.log("the path to", nextTile, "is blocked!");
        }else console.log("player can't go beyond the map!");
    }
    
    getCurrentPlayer(){
        return this.players[this.playerTurn];
    }

    setForbiddedPushTilePos(pos){
        this.forbiddedPushTilePos = pos;
    }

    checkIfPushable(pos){
        if(this.forbiddedPushTilePos == undefined) return true;
        else if(this.forbiddedPushTilePos.x == pos.x && this.forbiddedPushTilePos.y == pos.y) return false;
        else return true;
    }

    checkPlayerItem(){
        var cPlayer = this.getCurrentPlayer();
        var cPos = cPlayer.pos;
        if(cPlayer.takeItem(this.map.data[cPos.y][cPos.x].getItem()))
            this.map.data[cPos.y][cPos.x].setItem(0);
        if(cPlayer.victory) this.finishGame();
    }

    refreshPlayerPoints(){
        var treasuresLeftText = document.getElementById("treasuresLeft");
        treasuresLeftText.innerText = this.players[this.playerTurn].cards.length;
    }

    changePassableTileColors(){
        // this.push();
        // this.setFillColor(new Color(0,0,0,0));
        // this.setStrokeWidth(4);
        // this.setStrokeColor(this.players[this.playerTurn].color);
        this.explorer.workers.forEach(v => {
            this.passableTilesPreColors.push([new Worker(v.x, v.y), this.map.data[v.y][v.x].getColorCode()]);
            var preColor = this.players[this.playerTurn].color;
            var color = new Color(preColor.r, preColor.g, preColor.b, preColor.a);
            color.addColor(100, 100, 100);
            this.map.data[v.y][v.x].changeColor(color);
            // var cPos = new Worker(v.x*this.tileSize, v.y*this.tileSize);
            // this.drawRect(cPos.x+this.tileSize, cPos.y+this.tileSize, this.tileSize, this.tileSize);
        });
        // this.pop();
    }

    fixPassableTileColors(){
        this.passableTilesPreColors.forEach(arr => {
            var cPos = arr[0];
            this.map.data[cPos.y][cPos.x].changeColor(arr[1]);
        });
    }

    resetPassableTilesPreColors(){ this.passableTilesPreColors = []; }

    searchPaths(){
        var cPlayer = this.getCurrentPlayer();
        //console.log(cPlayer);
        this.explorer = new Explorer(cPlayer.pos.x, cPlayer.pos.y);
        console.log("searching for path...");
        console.log(this.explorer);
        for(var w = 0; w < this.explorer.workersNum; w++){
            var cWorker = this.explorer.workers[w];
            var cTile = this.map.data[cWorker.y][cWorker.x];
            var path = tileLists[cTile.id][cTile.version];
            //console.log("current worker:", cWorker, ", current tile:", cTile);
            path.forEach((v, i) => {
                if(v == 0) {
                    var moveAmt = this.legacy[i];
                    var xNum = cWorker.x + moveAmt.x;
                    var yNum = cWorker.y + moveAmt.y;
                    if(xNum >= 0 && xNum < this.map.maxTileNum && yNum >= 0 && yNum < this.map.maxTileNum){
                        //console.log("path found! Going to x:",xNum,", y:",yNum);
                        var nextTile = this.map.data[yNum][xNum];
                        //console.log("next tile:",nextTile);
                        var opposite = i + 2 > 3 ? i - 2 : i + 2;
                        if(tileLists[nextTile.id][nextTile.version][opposite] == 0)
                            this.explorer.replicate(new Worker(xNum, yNum));
                        //else console.log("path to next tile is blocked!");
                    }
                }
            });
        }
        console.log("final result of the path...", this.explorer.workers);

    }

    refreshCurrentCard(){
        var cPlayer = this.getCurrentPlayer();
        if(cPlayer.cards.length > 0){
            var cCard = cPlayer.cards[0];
            console.log("current Card:", cCard);
            var cColor = itemColorsByCode[cCard];
            var cardBox = document.getElementById("card");
            ctrlClassOfElementById("apply", "playerGotAllTreasure", "transparent");
            ctrlClassOfElementById("remove", "card", "transparent");
            var innerCard = document.getElementById("innerCard");
            var cardNumText = document.getElementById("currentCardNum");
            //console.log(cColor);
            var rgbaStyleColor = "rgba("+(cColor.r+55)+","+(cColor.g+55)+","+(cColor.b+55)+","+cColor.a+")";
            var rgbaStyleColorDark1 = "rgba("+(cColor.r-50)+","+(cColor.g-50)+","+(cColor.b-50)+","+cColor.a+")";
            var rgbaStyleColorDark2 = "rgba("+(cColor.r-80)+","+(cColor.g-80)+","+(cColor.b-80)+","+cColor.a+")";
            cardBox.style = "background: "+rgbaStyleColor;
            innerCard.style = "border-color: "+rgbaStyleColorDark1;
            cardNumText.innerText = cCard;
            cardNumText.style = "color: "+rgbaStyleColorDark2;
        }else{
            ctrlClassOfElementById("apply", "card", "transparent");
            ctrlClassOfElementById("remove", "playerGotAllTreasure", "transparent");
        }
        
    }

    refreshGameInfo(){
        var cPlayer = this.getCurrentPlayer();
        var pColor = cPlayer.color;
        var currentTurnText = document.getElementById("currentTurn");
        var playerTurnText = document.getElementById("playerTurn");
        var playerColorText = document.getElementById("playerColor");
        var rgbaColor = "color: rgba("+pColor.r+","+pColor.g+","+pColor.b+","+pColor.a+")";

        //display current turn
        currentTurnText.innerText = "Turn "+this.turn;
        //display current player's number and color
        playerTurnText.innerText = "Player "+(this.playerTurn+1)+"'s turn!";
        //there are two different ids because the circle does not want to align properly
        playerTurnText.style = rgbaColor;
        playerColorText.style = rgbaColor;
    }

    refreshPlayerPosText(){
        var pPos = this.players[this.playerTurn].pos;
        var playerPosText = document.getElementById("playerPos");
        //display player position
        playerPosText.innerText = "x: "+(pPos.x+1)+", y: "+(pPos.y+1);
    }

    changeTurn(){
        this.playerTurn++;
        if(this.playerTurn > this.numPlayers-1) {
            this.turn++;
            console.log("Turn "+this.turn+"!");
            this.playerTurn = 0;
        }
        this.refreshGameInfo();
        this.refreshPlayerPosText();

        console.log("Player "+(this.playerTurn+1)+"'s turn!");
    }

    rotateCurrentTile(amt){
        this.currentTile.version += amt;
        if(this.currentTile.version > 3) this.currentTile.version = 0;
        else if(this.currentTile.version < 0) this.currentTile.version = 3;
    }

    xPrePos = 0;
    moveCurrentTile(legacyIndex, yMoved=false){
        var moveAmt = this.legacy[legacyIndex];
        this.currentTilePos.x+=moveAmt.x;
        this.currentTilePos.y+=moveAmt.y;
        if(yMoved
            && this.currentTilePos.y > 0
            && this.currentTilePos.y < this.arrowPos.length-1
            && this.currentTilePos.x == 2){
                this.xPrePos = this.currentTilePos.x;
                this.currentTilePos.x = 1;
            }
        if(yMoved
            && (this.currentTilePos.y == 0
            || this.currentTilePos.y == this.arrowPos.length-1)
            && this.xPrePos == 2){
                this.currentTilePos.x = this.xPrePos;
                this.xPrePos = 0;
            }       
        if(this.currentTilePos.y < 0)
            this.currentTilePos.y = this.arrowPos.length-1;
        else if(this.currentTilePos.y > this.arrowPos.length-1)
            this.currentTilePos.y = 0;
        if(this.currentTilePos.x < 0)
            this.currentTilePos.x = this.arrowPos[this.currentTilePos.y].length-1;
        else if(this.currentTilePos.x > this.arrowPos[this.currentTilePos.y].length-1)
            this.currentTilePos.x = 0;
    }

    playersOnItemDrawChecker(){
        this.players.forEach(v => {
            var playerTile = this.map.data[v.pos.y][v.pos.x];
            console.log("player on item draw checker", playerTile);
            this.drawItem(playerTile, new Worker(v.pos.x*this.tileSize+this.tileSize, v.pos.y*this.tileSize+this.tileSize));
        });
    }

    pushPlayersChecker(){
        this.players.forEach(v => {
            var moveNum = new Worker(0, 0);
            var xNum, yNum = 0;
            if(this.currentTilePos.y == 0 || this.currentTilePos.y == 4){
                moveNum.y = this.currentTilePos.y == 0 ? 1 : -1;
                xNum = this.map.integrateArrowToMap("x", this.currentTilePos.x);
                if(v.pos.x == xNum) this.pushPlayer(v, moveNum);
            }
            else{
                moveNum.x = this.currentTilePos.x == 0 ? 1 : -1; 
                yNum = this.map.integrateArrowToMap("y", this.currentTilePos.y);
                if(v.pos.y == yNum) this.pushPlayer(v, moveNum);
            } 
            //console.log("player pos:", v.pos, "tile pos:", {x: xNum, y: yNum});
        });
    }

    pushPlayer(player, moveNum){
        var maxTileNum = this.map.data.length-1;
        player.pos.x += moveNum.x;
        player.pos.y += moveNum.y;
        if(player.pos.x < 0) player.pos.x = maxTileNum;
        else if(player.pos.x > maxTileNum) player.pos.x = 0;
        if(player.pos.y < 0) player.pos.y = maxTileNum;
        else if(player.pos.y > maxTileNum) player.pos.y = 0;
        this.refreshPlayerPosText();
    }

    drawTileBeforeShift(){
        //animation
    }

    drawPlayers(){
        this.players.forEach(v => {
            if(!v.victory){
                this.push();
                this.setStrokeColor(v.color);
                this.setFillColor(v.color);
                this.drawStartPos({x: v.pos.x*this.tileSize+this.tileSize, y: v.pos.y*this.tileSize+this.tileSize});
                this.pop();
            }
        });
    }

    drawX(pos){
        const ctx = this.canvases[this.currentCanvas].getContext('2d');
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x+this.tileSize, pos.y+this.tileSize);
        ctx.stroke();
        ctx.moveTo(pos.x+this.tileSize, pos.y);
        ctx.lineTo(pos.x, pos.y+this.tileSize);
        ctx.stroke();
        ctx.closePath();
    }

    drawStartPos(pos){
        const ctx = this.canvases[this.currentCanvas].getContext('2d');
        ctx.beginPath();
        ctx.arc(pos.x+this.tileSize/2, pos.y+this.tileSize/2, this.tileSize/6, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fill();
        ctx.closePath();
    }

    drawText(txt, pos){
        const ctx = this.canvases[this.currentCanvas].getContext('2d');
        ctx.beginPath();
        ctx.font = '36px serif';
        var txtWidth = ctx.measureText(txt).width;
        ctx.fillText(txt, pos.x+this.tileSize/2-(txtWidth/2), pos.y+this.tileSize/2+12);
        ctx.closePath();
    }

    generateNewTile(){
        this.currentTile = this.map.lostTile;
        this.currentTile.changeColor(2);
    }

    clearCanvas(all=false){
        if(all) this.canvases.forEach(v => { v.width += 0; });
        else this.canvases[this.currentCanvas].width += 0; // clears the canvas.
    }

    currentTilePos = new Worker(0, 0);
    drawCurrentTile(){
        this.push();
        const ctPos = this.arrowPos[this.currentTilePos.y][this.currentTilePos.x];
        this.drawTile(this.currentTile, ctPos);
        //if the tile is in a forbidded place
        if(!this.checkIfPushable(this.currentTilePos)){
            this.setStrokeColor(new Color(255,0,0,1));
            this.setStrokeWidth(4);
            this.drawX(this.arrowPos[this.currentTilePos.y][this.currentTilePos.x]);
        }
        this.pop();
    }

    drawTile(v, cPos){
        //initialization
        const size = this.tileSize;

        //background box
        this.push();
        var bgc = v.bgColor; //background color
        this.setFillColor(bgc);
        //this.setFillColor(100,200,100,1);
        this.setStrokeColor(new Color(0,0,0,0));
        this.drawRect(cPos.x, cPos.y, size, size);
        this.pop();

        //tile
        this.push();
        this.setFillColor(new Color(255,255,200));
        this.setStrokeColor(new Color(200,200,145,1));
        const target = tileLists[v.id][v.version];
        target.forEach((p, i) => {
            var next;
            if(i == 3) next = target[0];
            else next = target.slice(i + 1)[0];
            switch(p){
                case 0:
                    switch(i){
                        case 0:    
                            if(next == 0 || next == 1) this.drawRect(cPos.x+size/2, cPos.y, size/4, size/2);
                            if(next == 0) this.drawRect(cPos.x+size/2, cPos.y+size/4, size/2, size/4);
                            break;
                        case 1:
                            if(next == 0 || next == 1) this.drawRect(cPos.x+size/2, cPos.y+size/2, size/2, size/4);
                            if(next == 0) this.drawRect(cPos.x+size/2, cPos.y+size/2, size/4, size/2);
                            break;
                        case 2:
                            if(next == 0 || next == 1) this.drawRect(cPos.x+size/4, cPos.y+size/2, size/4, size/2);
                            if(next == 0) this.drawRect(cPos.x, cPos.y+size/2, size/2, size/4);
                            break;
                        case 3:
                            if(next == 0 || next == 1) this.drawRect(cPos.x, cPos.y+size/4, size/2, size/4);
                            if(next == 0) this.drawRect(cPos.x+size/4, cPos.y, size/4, size/2);
                            break;
                    }
                    break;
                case 1:
                    switch(i){
                        case 0:
                            if(next == 0) this.drawRect(cPos.x+size/2, cPos.y+size/4, size/2, size/4);
                            else if(next == 1) this.drawRect(cPos.x+size/2, cPos.y+size/4, size/4, size/4);
                            break;
                        case 1:
                            if(next == 0) this.drawRect(cPos.x+size/2, cPos.y+size/2, size/4, size/2);
                            else if(next == 1) this.drawRect(cPos.x+size/2, cPos.y+size/2, size/4, size/4);
                            break;
                        case 2:
                            if(next == 0) this.drawRect(cPos.x, cPos.y+size/2, size/2, size/4);
                            if(next == 1) this.drawRect(cPos.x+size/4, cPos.y+size/2, size/4, size/4);
                            break;
                        case 3:
                            if(next == 0) this.drawRect(cPos.x+size/4, cPos.y, size/4, size/2);
                            else if(next == 1) this.drawRect(cPos.x+size/4, cPos.y+size/4, size/4, size/4);
                            break;
                    }
                    break;
            }
        });
        this.pop();

        //outline of the box
        this.push();
        this.setStrokeColor(new Color(50,100,50,1));
        this.setFillColor(new Color(0,0,0,0));
        this.setStrokeWidth(2);
        this.drawRect(cPos.x, cPos.y, size, size);
        this.pop();

        //items on top
        this.drawItem(v, cPos);
        
    }

    drawItem(v, cPos){
        this.push();
        this.setStrokeColor(v.itemColor);
        this.setFillColor(new Color(v.itemColor.r+55, v.itemColor.g+55, v.itemColor.b+55, 0.4));
        switch(v.itemCode){
            case -1: this.drawStartPos(cPos); break;
            case 0: break; //nothing
            default:
                this.drawStartPos(cPos);
                this.setStrokeColor(v.itemColor);
                this.setFillColor(v.itemColor); 
                this.drawText(v.itemCode, cPos); 
                break;
        }
        this.pop();
    }

    drawMap(){
        this.currentCanvas = 0;
        const c = this.canvases[this.currentCanvas];
        const size = this.tileSize;
        this.push();
        this.setFillColor(new Color(200,200,0,1));
        this.setStrokeColor(new Color(0,0,0,0));
        this.drawRect(size/2, size/2, c.height-size, c.height-size);
        this.pop();
        this.map.data.forEach((arr, yi) => {
            arr.forEach((v, xi) => {
                var cPos = new Worker(xi*size+size, yi*size+size);
                this.push();
                this.setFillColor(new Color(55,55,117,1));
                this.setStrokeColor(new Color(0,0,0,0));
                if(yi == 0 && (xi == 1 || xi == 3 || xi == 5)){
                    this.shape([
                        [cPos.x+size/4, size-size/3],
                        [cPos.x+size-size/4, size-size/3],
                        [cPos.x+size/2, size-size/8]
                    ]);
                }
                else if(xi == 0 && (yi == 1 || yi == 3 || yi == 5)){
                    this.shape([
                        [size-size/3, cPos.y+size/4],
                        [size-size/3, cPos.y+size-size/4],
                        [size-size/8, cPos.y+size/2]
                    ]);
                }
                else if(yi == this.map.data.length-1 && (xi == 1 || xi == 3 || xi == 5)){
                    this.shape([
                        [cPos.x+size/4, c.height-size+size/3],
                        [cPos.x+size-size/4, c.height-size+size/3],
                        [cPos.x+size/2, c.height-size+size/8]
                    ]);
                }
                else if(xi == this.map.data.length-1 && (yi == 1 || yi == 3 || yi == 5)){
                    this.shape([
                        [c.height-size+size/3, cPos.y+size/4],
                        [c.height-size+size/3, cPos.y+size-size/4],
                        [c.height-size+size/8, cPos.y+size/2]
                    ]);
                }
                this.pop();

                this.drawTile(v, cPos);
            });
        });
    }

    shape(listOfLines){
        const ctx = this.canvases[this.currentCanvas].getContext('2d');
        ctx.beginPath();
        listOfLines.forEach((v, i) => {
            if(i == 0) ctx.moveTo(v[0], v[1]);
            else ctx.lineTo(v[0], v[1]);
        });
        ctx.fill();
        ctx.stroke();
        ctx.closePath();
    }

    setStrokeWidth(w){
        const ctx = this.canvases[this.currentCanvas].getContext('2d');
        ctx.lineWidth = w;
    }

    push(){
        const ctx = this.canvases[this.currentCanvas].getContext('2d');
        ctx.save();
    }

    pop(){
        const ctx = this.canvases[this.currentCanvas].getContext('2d');
        ctx.restore();
    }

    drawImage(img, x=0, y=0, imgw=undefined, imgh=undefined, dx=0, dy=0, dw=undefined, dh=undefined){
        if(img == undefined) console.log("image not passed in drawImage()");
        if(imgw == undefined || imgh == undefined){
            imgw = img.naturalWidth;
            imgh = img.naturalHeight;
        }
        const ctx = this.canvases[this.currentCanvas].getContext('2d');
        if(dw == undefined || dh == undefined) ctx.drawImage(img, x, y, imgw, imgh);
        else ctx.drawImage(img, x, y, imgw, imgh, dx, dy, dw, dh);
    }

    drawRect(x, y, w, h){
        const ctx = this.canvases[this.currentCanvas].getContext('2d');
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.fill();
        ctx.stroke();
        ctx.closePath();
    }

    setFillColor(color){
        if(color == undefined)
            color = new Color();
        const ctx = this.canvases[this.currentCanvas].getContext('2d');
        ctx.fillStyle = "rgba("+color.r+","+color.g+","+color.b+","+color.a+")";
    }

    setStrokeColor(color){
        if(color == undefined)
            color = new Color();
        const ctx = this.canvases[this.currentCanvas].getContext('2d');
        ctx.strokeStyle = "rgba("+color.r+","+color.g+","+color.b+","+color.a+")";
    }

    background(r, g, b, a, all=false){
        if(r == undefined) r = 0;
        if(g == undefined) g = 0;
        if(b == undefined) b = 0;
        if(a == undefined) a = 1;
        //console.log("background called! rgba() => ",r,g,b,a);
        var target;
        if(all) target = this.canvases;
        else target = [this.canvases[this.currentCanvas]];
        target.forEach(c => {
            const ctx = c.getContext('2d');
            ctx.beginPath();
            ctx.fillStyle = "rgba("+r+","+g+","+b+","+a+")";
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.fill();
            ctx.closePath(); 
        });
    }

}