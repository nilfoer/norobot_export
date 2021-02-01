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
    } else if (req.action == "send_contexts") {
        // apparently there are no contextualIdentities for default or private mode
        // so can't really use that
        // alternatively we could pass the contexts along with the store
        // and if the storeIds match then use the context for name and color
        console.log("Got send_stores", req.contexts);

        let container = document.getElementById("container");
        // remove all previous
        while (container.firstChild) {
            container.removeChild(container.lastChild);
        }

        for (ctx of req.contexts) {
            let button = document.createElement("div");
            button.classList.add("button");
            button.classList.add("get-cookie-store");
            // add data-store-id attrib
            button.dataset.storeId = ctx.cookieStoreId;
            button.style.backgroundColor = ctx.colorCode;

            let textnode = document.createTextNode(ctx.name);
            button.appendChild(textnode);

            container.appendChild(button);
            
            // click event
            button.addEventListener("click", handleButtonClick);
        }
    }
}
browser.runtime.onMessage.addListener(handleMessage);
browser.runtime.sendMessage({ action: "get_stores" });

