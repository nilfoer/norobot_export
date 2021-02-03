const dl_icon_url = browser.runtime.getURL("ico/download-solid.svg");

function handleButtonClick(e) {
    let store_id = e.target.dataset.storeId;
    console.log("Clicked", store_id);
    browser.runtime.sendMessage({
        action: "get_cookies",
        store_id: store_id,
        download: false
    });
}

function handleButtonClickDownload(e) {
    // target is the element that triggered the event (e.g., the user clicked on)
    // here: might also be the img or object/svg tag
    // currentTarget is the element that the event listener is attached to.
    // here: alway the button-addon
    let store_id = e.currentTarget.dataset.storeId;
    console.log("Clicked download", store_id);
    browser.runtime.sendMessage({
        action: "get_cookies",
        store_id: store_id,
        download: true
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

            let button_container = document.createElement("div");
            button_container.classList.add("button-container");

            let button = document.createElement("div");
            button.classList.add("button");
            button.classList.add("copy-cookie-store");

            let button_addon = document.createElement("div");
            button_addon.classList.add("button-addon");
            button_addon.classList.add("download-cookie-store");

            // apparently you have to use obj or img to be able to load an svg properly by url
            // but then you're not able to change the fill color ???!?
            // and the fill currentColor doesn't work - what a mess
            // object tag can't be clicked so use image
            // but then <style> inside the svg doesnt work anymore and neither does
            // the fill attribute itself !??$?$?#?$#?
            // so use filter hack to invert the color from black to white (see css)
            let dl_icon_obj = document.createElement("img");
            dl_icon_obj.classList.add("ico-container");
            dl_icon_obj.src = dl_icon_url;
            button_addon.appendChild(dl_icon_obj);

            let textnode;
            if (ctx) {
                // add data-store-id attrib
                button.dataset.storeId = ctx.cookieStoreId;
                button.style.backgroundColor = ctx.colorCode;
                button_addon.dataset.storeId = ctx.cookieStoreId;
                button_addon.style.backgroundColor = ctx.colorCode;

                textnode = document.createTextNode(ctx.name);
            } else {
                // add data-store-id attrib
                button.dataset.storeId = store.id;
                button_addon.dataset.storeId = store.id;

                textnode = document.createTextNode(store.id);
            }
            button.id = store.id;

            button_container.appendChild(button);
            button_container.appendChild(button_addon);
            button.appendChild(textnode);
            container.appendChild(button_container);
            
            // click event
            button.addEventListener("click", handleButtonClick);
            button_addon.addEventListener("click", handleButtonClickDownload);
        }
    } else if (req.action == "copy_cookies") {
        let button = document.getElementById(req.store_id);
        let res = req.result;
        if (res === 'success') {
            button.style.backgroundColor = 'green';
            button.textContent = 'Copied to clip!';
        } else if (res === 'fail') {
            button.style.backgroundColor = 'red';
            button.textContent = 'FAILED!';
        } else {
            // res === 'no_cookies'
            button.style.backgroundColor = '#ffe82c';
            button.style.color = '#515151';
            button.textContent = 'No relevant cookies!';
        }
    }
}
browser.runtime.onMessage.addListener(handleMessage);
browser.runtime.sendMessage({ action: "get_envs" });

