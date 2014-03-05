function writeToDom(val) {
    var div = document.createElement("div");
    var pre = document.createElement("pre");
    pre.appendChild(document.createTextNode(val));
    div.appendChild(pre);
    document.body.appendChild(div);
}

var me = {
    name: "Jim",
    city: "Nashville",
    family: ["Steph"]
};

var undoableMe = new revertjs.Undoable(me, {}, "me");

undoableMe.name = "James";
undoableMe.family.splice(1, 0, "James", "Nate");
undoableMe.city = "Chattanooga";
undoableMe.family.push("Amelia");
undoableMe.undo();
undoableMe.family.push("Ian");

writeToDom(JSON.stringify(undoableMe, null, 2));