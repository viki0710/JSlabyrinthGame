function ctrlClassOfElementById(cmd, id, className){
    var element = document.getElementById(id);    
    //console.log(element, cmd, className);
    switch(cmd){
        case "apply":
            element.classList.add(className);
            break;
        case "remove":
            element.classList.remove(className);
            break;
    }
}

function changeScreen(id){
    var screens = ["mainmenu", "instructions", "author", "game", "victory"];
    var continued = false;
    if(id == "continue"){
        continued = true;
        //do something to restore the saved data.
        id = "game";
    }
    //keep preset of screens. Only apply change screen for these.
    //if id is v, then it will show up, and others will be transparent.
    screens.forEach(v => {
        if(v == id) ctrlClassOfElementById("remove", v, "transparent");
        else ctrlClassOfElementById("apply", v, "transparent");
    });

    //game start!
    if(id == "game"){
        if(!continued) startGame();
        else loadGame();
    }
}

function doubleCheckToReturn(){
    if(confirm("Are you sure you want to return?\nGame data will not be saved if not saved.")) {
        resetGameGlobalVariables();
        changeScreen('mainmenu');
    }
}

function doubleCheckToSave(){
    if(confirm("Are you sure you want to save?\nThe previous save data will be overwritten.")) 
        saveGame();
}

var saved;

window.onload = function(){

    saved = JSON.parse(localStorage.getItem("saved"));
    if(!saved){
        //if no save data
        document.getElementById("continueButton").disabled = true;
        ctrlClassOfElementById("apply", "continueButton", "disabled");
    }
}