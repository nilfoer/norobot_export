// this is the background_script
// Content scripts and background scripts can't directly access each other's state. However, they can communicate by sending messages. One end sets up a message listener, and the other end can then send it a message.

// then()
/* The Promise API proposes the following:
Each asynchronous task will return a promise object.
Each promise object will have a then function that can take two arguments, a success handler and an error handler.
The success or the error handler in the then function will be called only once, after the asynchronous task finishes.
The then function will also return a promise, to allow chaining multiple calls.
Each handler (success or error) can return a value, which will be passed to the next function as an argument, in the chain of promises.
If a handler returns a promise (makes another asynchronous request), then the next handler (success or error) will be called only after that request is finished.
*/
function messageTab(msg, tabs) {
    // use tabs.sendMessage() to send a message to the content scripts loaded into that tab
    browser.tabs.sendMessage(tabs[0].id, {
        uniques: msg
    });
}

/* use trick to pass more params to chained then: https://stackoverflow.com/questions/32912459/promises-pass-additional-parameters-to-then-chain
Perhaps the most straightforward answer is:

P.then(function(data) { return doWork('text', data); });
Or, since this is tagged ecmascript-6, using arrow functions:

P.then(data => doWork('text', data));

OR 

You can use Function.prototype.bind to create a new function with a value passed to its first argument, like this

P.then(doWork.bind(null, 'text'))
and you can change doWork to,

function doWork(text, data) {
  consoleToLog(data);
}
Now, text will be actually 'text' in doWork and data will be the value resolved by the Promise
*/
function sendResponseToActiveTab(msg) {    
    console.log("To conentjs: ", msg);
    // use tabs.query() to get the currently active tab
    var querying = browser.tabs.query({
        active: true,
        currentWindow: true
    });
    // use trick to pass more params to chained then; data is here the value resolved by the Promise from querying
    querying.then(function(data) { return messageTab(msg, data); });
}

function onError(error) {
  console.log(`Error: ${error}`);
}


// http://www.cookiecentral.com/faq/ 3.5
// The layout of Netscape's cookies.txt file is such that each line contains
// one name-value pair. An example cookies.txt file may have an entry that
// looks like this:
// .netscape.com   TRUE   /   FALSE   946684799   NETSCAPE_ID   100103
// Each line represents a single piece of stored information. A tab is inserted between each of the fields.
// From left-to-right, here is what each field represents:
// domain - The domain that created AND that can read the variable.
// flag - A TRUE/FALSE value indicating if all machines within a given domain
//        can access the variable. This value is set automatically by the browser,
//        depending on the value you set for domain.
// path - The path within the domain that the variable is valid for.
// secure - A TRUE/FALSE value indicating if a secure connection with the
//          domain is needed to access the variable.
// expiration - The UNIX time that the variable will expire on. UNIX time is
//              defined as the number of seconds since Jan 1, 1970 00:00:00 GMT.
// name - The name of the variable.
// value - The value of the variable.
// 
function generateNetscapeCookieFile(cookies, user_agent) {
    // insert User-Agent that is needed to assume the browser's identity as
    // a comment so it's still a valid cookies.txt
    let str_builder = [
        '# Netscape HTTP Cookie File',
        '# https://curl.haxx.se/rfc/cookie_spec.html',
        `# User-Agent: ${user_agent}`,
    ]

    for (let cookie of cookies) {
        str_builder.push([
            cookie.domain,
            cookie.hostOnly ? 'FALSE' : 'TRUE',
            cookie.path,
            cookie.secure ? 'TRUE' : 'FALSE',
            // use 0 for session cookies and cookies without expiration date
            cookie.session || !cookie.expirationDate ? 0 : cookie.expirationDate,
            cookie.name,
            cookie.value,
        ].join('\t'));
    }

    return str_builder.join('\n');
}

function getCookiesByName(store_id, name) {
    // getAll gets all cookies matching the details object that takes arguments
    // like name, storeId etc.
    let cookie_getter = browser.cookies.getAll({name: name, storeId: store_id});
    return cookie_getter;
}

// extension button clicked
// browser.browserAction.onClicked.addListener(() => {});
function getCookiesByStoreId(store_id) {
    // DDoS protection by cloudflare checks that we use the same User-Agent as the
    // browser that passed the js challenge
    let user_agent = window.navigator.userAgent;
    console.log("User-Agent:", user_agent);
    // Windows in different browsing modes may use different cookie stores
    // e.g. private vs non-private
    // has a tabIds field that tells us which tabs this store gets used by
    let cookie_stores = browser.cookies.getAllCookieStores();
    cookie_stores.then(cookie_stores => {
        let found_store;
        for (let store of cookie_stores) {
            if (store.id == store_id) {
                found_store = store;
                break
            }
        }

        if (!found_store) {
            console.log("No CookieStore with that Id");
            return;
        }

        let filtered_cookies_in_store = []

        let get_clearance_cookies = getCookiesByName(found_store.id, 'cf_clearance');
        let get_uid_cookies = getCookiesByName(found_store.id, '__cfduid');

        // array won't be populated if we pass it on normally
        // need to use then to do it after the 2 populating functions are done
        // use Promise.all to wait on the two populators
        // return values will be in an array in the same order we passed
        // the Promises in
        Promise.all([get_clearance_cookies, get_uid_cookies]).then((cookies) => {
            // use destructuring assignment to unpack the values
            let clearance_cookies, uid_cookies;
            [clearance_cookies, uid_cookies] = cookies
            // extend arrya by unpacking cookies array with ... into push that
            // normally only takes one arg
            // filtered_cookies_in_store.push(...cookies);
            // or use concat
            filtered_cookies_in_store = clearance_cookies.concat(uid_cookies);

            if (filtered_cookies_in_store.length > 0) {
                navigator.clipboard.writeText(
                    generateNetscapeCookieFile(
                        filtered_cookies_in_store, user_agent)).then(function() {
                            /* clipboard successfully set */
                            console.log("Cookies copied to clip!");
                        }, function() {
                            /* clipboard write failed */
                            console.log("FAILED to copy cookies to clip!");
                        });
                console.log();
            } else {
                console.log("No relevant cookies found in cookie store", found_store.id);
            }

        });
    });
}

function handleMessage(req, sender, sendResponse) {
    if (req.action == "get_contexts") {
        // use contextualIdentities (environments like work, leisure etc.)
        // they have cookieStoreId field
        browser.contextualIdentities.query({}).then((contexts) => {
            browser.runtime.sendMessage({ action: "send_contexts",
                                          contexts: contexts });
        });
    } else if (req.action == "get_stores") {
        // resolve promise
        browser.cookies.getAllCookieStores().then((stores) => {
            browser.runtime.sendMessage({ action: "send_stores",
                                          stores: stores });
        });
    } else if (req.action == "get_cookies") {
        getCookiesByStoreId(req.store_id);
    }
}

// wait for popup to send msg
browser.runtime.onMessage.addListener(handleMessage);
