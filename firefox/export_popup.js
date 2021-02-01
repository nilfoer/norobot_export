function handleButtonClick(e) {
    let store_id = e.target.dataset.storeId;
    console.log("Clicked", store_id);
    browser.runtime.sendMessage({
        action: "get_cookies",
        store_id: store_id
    });
}

function handleMessage(req, sender, sendResponse) {
    if (req.action == "send_envs") {
        // console.log("Got send_envs", req.envs);

        let container = document.getElementById("container");
        // remove all previous
        while (container.firstChild) {
            container.removeChild(container.lastChild);
        }

        // apparently there are no contextualIdentities for default or private mode
        // so can't really use that
        // but we can pass the contexts along with the store
        for (env of req.envs) {
            let store = env.store;
            let ctx = env.ctx;

            let button = document.createElement("div");
            button.classList.add("button");
            button.classList.add("get-cookie-store");

            let textnode;
            if (ctx) {
                // add data-store-id attrib
                button.dataset.storeId = ctx.cookieStoreId;
                button.style.backgroundColor = ctx.colorCode;
                textnode = document.createTextNode(ctx.name);
            } else {
                // add data-store-id attrib
                button.dataset.storeId = store.id;
                textnode = document.createTextNode(store.id);
            }

            button.appendChild(textnode);
            container.appendChild(button);
            
            // click event
            button.addEventListener("click", handleButtonClick);
        }
    }
}
browser.runtime.onMessage.addListener(handleMessage);
browser.runtime.sendMessage({ action: "get_envs" });

