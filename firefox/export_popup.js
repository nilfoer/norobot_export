function handleButtonClick(e) {
    let store_id = e.target.dataset.storeId;
    console.log("Clicked", store_id);
    browser.runtime.sendMessage({
        action: "get_cookies",
        store_id: store_id
    });
}

// function addButtonClickEvents() {
//     let buttons = document.getElementsByClassName("get-cookie-store");
//     for (button of buttons) {
//         button.addEventListener("click",
//     });
// }

function handleMessage(req, sender, sendResponse) {
    if (req.action == "send_stores") {
        console.log("Got send_stores", req.stores);

        let container = document.getElementById("container");
        // remove all previous
        while (container.firstChild) {
            container.removeChild(container.lastChild);
        }

        for (store of req.stores) {
            // let li = document.createElement("div");
            // li.classList.add("panel-list-item");
            // let button = document.createElement("div");
            // button.classList.add("button");
            // button.classList.add("get-cookie-store");
            // // add data-store-id attrib
            // button.dataset.storeId = store.id;
            // let textnode = document.createTextNode(store.id);
            // button.appendChild(textnode);

            // li.appendChild(button);
            // container.appendChild(li);

            let button = document.createElement("div");
            button.classList.add("button");
            button.classList.add("get-cookie-store");
            // add data-store-id attrib
            button.dataset.storeId = store.id;
            let textnode = document.createTextNode(store.id);
            button.appendChild(textnode);

            container.appendChild(button);
            
            // click event
            button.addEventListener("click", handleButtonClick);
        }
    }
}
browser.runtime.onMessage.addListener(handleMessage);
browser.runtime.sendMessage({ action: "get_stores" });

