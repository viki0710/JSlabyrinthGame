const tileLists = [
    [[1,0,0,0], [0,1,0,0], [0,0,1,0], [0,0,0,1]],
    [[1,1,0,0], [0,1,1,0], [0,0,1,1], [1,0,0,1]],
    [[1,0,1,0], [0,1,0,1], [1,0,1,0], [0,1,0,1]]
]; //[id][version] -> pass; eg. [0][0] = [1,0,0,0]

var maxNumItems = 0;
var generatedNumItems = 0;
var itemColorsByCode = [null];

class Tile{
    id; version; bgColor; itemCode; itemColor; bgColorCode;
    constructor(id, version, bgCode=0, itemCode=undefined, itemColor=undefined){
        if(id != -1){
            if(typeof(id)=="number" && id < 3 && id >= 0) this.id = id; 
            else this.id = getRandom(3); //0, 1, or 2 if undefined or out of scope.
            if(typeof(version)=="number" && version < 4 && version >= 0) this.version = version;
            else this.version = getRandom(4); //0, 1, 2, or 3 if undefined or out of scope.
            if(typeof(itemCode)!="number"){
                var itemOrNot = getRandom(10);
                //100-80 = 20% chance
                if(itemOrNot >= 8) this.generateItem();
                else this.setItem(0);
            }else this.setItem(itemCode, itemColor);
            this.changeColor(bgCode);
        }else{
            for(let [key, value] of Object.entries(version)){
                if(key == "bgColor" || key == "itemColor") this[key] = new Color(value.r, value.g, value.b, value.a);
                else this[key] = value;
            }
        }
    }
    getId(){ return this.id; }
    rotate(){ this.version = this.version + 1 > 3 ? 0 : this.version + 1; } //ex. [1,1,0,0] -> [0,1,1,0] -> [0,0,1,1] -> [1,0,0,1] -> [1,1,0,0]
    shuffle(){ this.version = Math.floor(Math.random()*4); } //number of rotations. can only rotate 4 times.
    changeColor(bgCode){
        if(typeof(bgCode) == "number"){
            switch(bgCode){
                case 0:
                    this.bgColor = new Color(100, 200, 100, 1);
                    break;
                case 1:
                    this.bgColor = new Color(170, 200, 170, 1);
                    break;
                case 2:
                    this.bgColor = new Color(200, 200, 100, 1);
                    break;
                default: break;
            }
            this.bgColorCode = bgCode;
        }else if(typeof(bgCode) == "object"){
            this.bgColor = bgCode;
            this.bgColorCode = -1;
        }
    }
    getColor(){ return this.bgColor; }
    getColorCode(){ return this.bgColorCode; }
    generateItem(){
        console.log("attempting to generate tile with item...");
        if(generatedNumItems < maxNumItems){
            console.log("successfully placed!");
            generatedNumItems++;
            this.setItem(generatedNumItems);
        }else{
            console.log("generated item number exceeded max item number!\nSetting a tile without item...");
            this.setItem(0);
        }
    }
    setItem(itemCode, itemColor=undefined){
        if(generatedNumItems > itemColorsByCode.length-1)
            itemColorsByCode.push(new Color(getRandom(100, 200), getRandom(100, 200), getRandom(100, 200)));
        if(itemColor==undefined && itemCode > 0 && itemCode <= maxNumItems)
            itemColor = itemColorsByCode[itemCode];
        else if(itemColor==undefined) itemColor = new Color();
        this.itemCode = itemCode;
        this.itemColor = itemColor;
    }
    getItem(){
        return this.itemCode;
    }
    // getImg(){ return this.img; }
    // setImg(img){ this.img = img; }
}

//itemCode:
// -1 : spawn
//  0 : none
//  1 : 

function getRandom(num1=undefined, num2=undefined){
    //console.log(!num1, !num2);
    if(!num1 && !num2) return 0;
    else if(!num2) return Math.floor(Math.random()*num1);
    else if(!num1) return Math.floor(Math.random()*num2);
    else return Math.floor(Math.random()*(num2 - num1) + num1);
    //0 ~ num-1
    
}

class Color{
    r; g; b; a;
    constructor(r=0, g=0, b=0, a=1){
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
    addColor(r=0, g=0, b=0, a=0){
        this.r += r;
        this.g += g;
        this.b += b;
        this.a += a;
    }
}

class Character{
    index; pos; color; cards; victory; spawn;
    constructor(index, pos, color, cards){
        if(index != -1){
            this.index = index;
            this.pos = pos;
            this.color = color;
            this.victory = false;
            this.spawn = new Worker(pos.x, pos.y);
            this.setCards(cards);
        }else{
            for(let [key, value] of Object.entries(pos)){
                if(key == "color") this[key] = new Color(value.r, value.g, value.b, value.a);
                else if(key == "pos" || key == "spawn") this[key] = new Worker(value.x, value.y);
                else this[key] = value;
            }
        }
        
    }
    setCards(arr){ this.cards = arr; }
    getCurrentCard(){ return this.cards[0]; }
    takeItem(num){
        if(num == this.cards[0]){
            this.cards.shift();
            return true;
        }else if(num == -1 && this.cards.length == 0 && this.pos.x == this.spawn.x && this.pos.y == this.spawn.y){
            this.victory = true;
            return true;
        }else return false;
    }

}

class Map{
    data; 
    lostTile;
    maxTileNum;
    constructor(cond=false, size=7){
        if(!cond){
            this.maxTileNum = size;
            var generatedTiles = {straightLines: 0, turns: 0, threeWay: 0};
            //this.data = Array(size).fill(0).map(x => Array(size).fill(new Tile()));
            this.data = Array(size).fill(0).map(x => Array(size).fill(undefined));
            this.data.forEach((arr, y) => {
                arr.forEach((v, x) => {
                    //this.data[y][x] = new Tile();
                    var newTile;
                    var idSpecification;
                    var ids = [0, 1, 2];
                    var isMovableTile = false;
                    
                    //id specifications
                    if(generatedTiles.threeWay >= 6) ids.splice(ids.indexOf(0), 1);
                    if(generatedTiles.turns >= 15) ids.splice(ids.indexOf(1), 1);
                    if(generatedTiles.straightLines >= 13) ids.splice(ids.indexOf(2), 1);
                    idSpecification = ids[getRandom(ids.length)];
    
                    //console.log(ids, idSpecification, generatedTiles);
                    switch(y){
                        case 0:
                            switch(x){
                                case 0: newTile = new Tile(1, 3, 1, 0); break; //corner
                                case 2: newTile = new Tile(0, 0, 1); break;
                                case 4: newTile = new Tile(0, 0, 1); break;
                                case 6: newTile = new Tile(1, 0, 1, 0); break; //corner
                                default: newTile = new Tile(idSpecification); isMovableTile = true; break;
                            }
                            break;
                        case 2:
                            switch(x){
                                case 0: newTile = new Tile(0, 3, 1); break;
                                case 2: newTile = new Tile(0, 3, 1); break;
                                case 4: newTile = new Tile(0, 0, 1); break;
                                case 6: newTile = new Tile(0, 1, 1); break;
                                default: newTile = new Tile(idSpecification); isMovableTile = true; break;
                            }
                            break;
                        case 4:
                            switch(x){
                                case 0: newTile = new Tile(0, 3, 1); break;
                                case 2: newTile = new Tile(0, 2, 1); break;
                                case 4: newTile = new Tile(0, 1, 1); break;
                                case 6: newTile = new Tile(0, 1, 1); break;
                                default: newTile = new Tile(idSpecification); isMovableTile = true; break;
                            }
                            break;
                        case 6:
                            switch(x){
                                case 0: newTile = new Tile(1, 2, 1, 0); break; //corner
                                case 2: newTile = new Tile(0, 2, 1); break;
                                case 4: newTile = new Tile(0, 2, 1); break;
                                case 6: newTile = new Tile(1, 1, 1, 0); break; //corner
                                default: newTile = new Tile(idSpecification); isMovableTile = true; break;
                            }
                            break;
                        default: newTile = new Tile(idSpecification); isMovableTile = true; break;
                    }
                    if(isMovableTile){
                        switch(newTile.id){
                            //3 way crossings
                            case 0: generatedTiles.threeWay++; break;
                            case 1: generatedTiles.turns++; break;
                            case 2: generatedTiles.straightLines++; break;
                        }
                    }
                    this.data[y][x] = newTile;
                });
            });
    
            if(generatedTiles.threeWay < 6) this.lostTile = new Tile(0);
            else if(generatedTiles.turns < 15) this.lostTile = new Tile(1);
            else this.lostTile = new Tile(2); //generatedTiles.straightLines < 13
    
            console.log("Map generated! generatedItemNum:", generatedNumItems);
            console.log("generated tiles:", generatedTiles);
            while(generatedNumItems < maxNumItems){
                console.log("Item less than "+maxNumItems+"! Generating Item...");
                try{
                    var pos = {x: getRandom(7), y: getRandom(7)}
                    if((pos.x == 0 || pos.x == 6) && (pos.y == 0 || pos.y == 6))
                        throw "Reattempting... item spawned in the corner!";
                    else if(this.data[pos.y][pos.x].getItem() > 0)
                        throw "Item already exists in this tile!";
                    this.data[pos.y][pos.x].generateItem();
                    console.log("Set! pos:",pos,"Item:",this.data[pos.y][pos.x].getItem());
                }catch(e){
                    console.log(e);
                }
            }
        }else{
            for(let [key, value] of Object.entries(size)){
                if(key == "lostTile") this.lostTile = new Tile(-1, value);
                else if(key == "data"){
                    this.data = value;
                    value.forEach((arr, y) => {
                        arr.forEach((v, x) => {
                            this.data[y][x] = new Tile(-1, v);
                        });
                    });
                }
                else this[key] = value;
            }
        }
    }
    pushNewTile(tile, pos){
        var d = this.pickRow(pos);
        var tileBeforeShift = d.row;
        //console.log(d);
        var lostTile;
        if(d.rowCond == 'end'){
            d.row.push(tile);
            lostTile = d.row[0];
            //d.row.shift();
            this.pickRow(pos, 'set', d.row.slice(1));
        }
        else if(d.rowCond == 'first'){
            d.row.splice(0, 0, tile);
            lostTile = d.row[d.row.length-1];
            //d.row.pop();
            this.pickRow(pos, 'set', d.row.slice(0, d.row.length-1));
        }
        this.lostTile = lostTile;
        console.log("tile pushed!", pos, d);
        //returns the forbidded tile.
        return d.forbiddedPos;
    }
    pickRow(pos, cond='get', row=undefined){
        var align;
        if(pos.y == 0 || pos.y == 4){
            align = "vertical";
            var xNum = this.integrateArrowToMap('x', pos.x);
            if(cond=='get'){
                var selectedRow = [];
                this.data.forEach(arr => { selectedRow.push(arr[xNum]); });
                var rowCond = pos.y == 0 ? 'first' : 'end';
                var forbiddedPos = {x: pos.x, y: undefined};
                forbiddedPos.y = pos.y == 0 ? 4 : 0;
                return {row: selectedRow, rowCond: rowCond, forbiddedPos: forbiddedPos};
            }else if(cond=='set')
                this.data.forEach((arr, y) => { this.data[y][xNum] = row[y] });
        }
        else{
            align = "horizontal";
            var yNum = this.integrateArrowToMap('y', pos.y);
            var rowCond = pos.x == 0 ? 'first' : 'end';
            var forbiddedPos = {x: undefined, y: pos.y};
            forbiddedPos.x = pos.x == 0 ? 1 : 0;
            if(cond=='get')
                return {row: this.data[yNum], rowCond: rowCond, align: align, forbiddedPos: forbiddedPos};
            else if(cond='set')
                this.data[yNum] = row;
        }
    }
    integrateArrowToMap(cond, num){
        switch(cond){
            case 'x':
                switch(num){
                    case 0: return 1; break;
                    case 1: return 3; break;
                    case 2: return 5; break;
                } 
                break;
            case 'y':
                switch(num){
                    case 1: return 1; break;
                    case 2: return 3; break;
                    case 3: return 5; break;
                }
                break;
        }
    }
    /*searchTileByItemCode(itemCode){
        var returnItem;
        this.data.forEach(arr => {
            arr.forEach(v => {
                //console.log(v.getItem(), v.getItem() == itemCode);
                if(v.getItem() == itemCode) returnItem = v;
            });
        });
        return returnItem;
    }*/
}

class Explorer{
    workers; workersNum;
    constructor(x=0, y=0){
        if(x != -1){
            this.workers = [];
            this.workersNum = 0;
            this.replicate(new Worker(x, y));
        }else{
            for(let [key, value] of Object.entries(y)){
                if(key == "workers"){
                    var workers = value;
                    workers.forEach((v, i) => {
                        workers[i] = new Worker(v.x, v.y);
                    });
                    this.workers = workers;
                } else this[key] = value;
            }
        }
        
    }
    replicate(worker){
        var isDuplicated = false;
        this.workers.forEach(v => {
            if(v.x == worker.x && v.y == worker.y) isDuplicated = true;
        });
        if(!isDuplicated){
            this.workers.push(worker);
            this.workersNum++;
        }
    }
}

class Worker{
    x; y;
    constructor(x, y){
        this.x = x;
        this.y = y;
    }
    addWorker(worker){
        this.x += worker.x;
        this.y += worker.y;
    }
    setY(y){ this.y = y; }
    addY(y){ this.y += y; }
    setX(x){ this.x = x; }
    addX(x){ this.x += x; }
    getY(){ return this.y; }
    getX(){ return this.x; }

}