// http://www.cookiecentral.com/faq/#3.5
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
    // insert User-Agent that is needed to assume the browser's identity (as far
    // as DDoS protection is concerned) as a comment so it's still a valid cookies.txt
    let str_builder = [
        '# Netscape HTTP Cookie File\n',
        '# https://curl.haxx.se/rfc/cookie_spec.html\n',
        `# User-Agent: ${user_agent}\n\n`,
    ]

    
    for (let cookie of cookies) {
        let domain_prefix = (!cookie.hostOnly && cookie.domain.length > 0
                             && cookie.domain[0] !== '.') ? '.' : '';
        str_builder.push([
            // #HttpOnly_ prefix apparently not that widely supported
            // TODO provide as option
            // e.g. youtube-dl won't parse it properly
            // hostOnly:
            // A boolean, true if the cookie is a host-only cookie (i.e. the
            // request's host must exactly match the domain of the cookie)
            // -> no subdomains
            // so the domain part should start with a dot if the cookie is valid for
            // subdomains as well
            `${domain_prefix}${cookie.domain}`,
            cookie.hostOnly ? 'FALSE' : 'TRUE',
            cookie.path,
            cookie.secure ? 'TRUE' : 'FALSE',
            // use 0 for session cookies and cookies without expiration date
            cookie.session || !cookie.expirationDate ? 0 : cookie.expirationDate,
            cookie.name,
            cookie.value,
        ].join('\t') + '\n');  // append newline since we can't join when creating a Blob
    }

    // need to convert to Blob later and that expects a sequence
    // return str_builder.join('\n');
    return str_builder
}

function getCookiesByName(store_id, name) {
    // getAll gets all cookies matching the details object that takes arguments
    // like name, storeId etc.
    let cookie_getter = browser.cookies.getAll({name: name, storeId: store_id});
    return cookie_getter;
}

// extension button clicked
// browser.browserAction.onClicked.addListener(() => {});
function getCookiesByStoreId(store_id, download) {
    // DDoS protection by cloudflare checks that we use the same User-Agent as the
    // browser that passed the js challenge
    let user_agent = window.navigator.userAgent;
    // console.log("User-Agent:", user_agent);
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
            browser.runtime.sendMessage({
                action: "copy_cookies",
                store_id: store_id,
                success: false
            });
            return;
        }

        let filtered_cookies_in_store = []

        // technically we only need the cf_clearance cookie and the User-Agent header
        // but let's get it anyway in case they change it
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

            // since the __cfduid is useless without the cf_clearance cookie
            // filter the duid cookies by having a clearance cookie for the same domain
            let domain_to_cookie = {};
            for (cl_cookie of clearance_cookies) {
                domain_to_cookie[cl_cookie.domain] = 1;
            }
            // duid cookies that also have cf_clearance cookie counterpart
            let uid_cookies_filtered = [];
            for (uid_cookie of uid_cookies) {
                if (uid_cookie.domain in domain_to_cookie) {
                    uid_cookies_filtered.push(uid_cookie);
                }
            }
            
            // extend arrya by unpacking cookies array with ... into push that
            // normally only takes one arg
            // filtered_cookies_in_store.push(...cookies);
            // or use concat
            filtered_cookies_in_store = clearance_cookies.concat(uid_cookies_filtered);

            if (filtered_cookies_in_store.length > 0) {
                if (download) {
                    let cookie_lines = generateNetscapeCookieFile(
                        filtered_cookies_in_store, user_agent);

                    if (!cookie_lines) {
                        /* failed */
                        console.log("FAILED to generate cookies file!");
                        browser.runtime.sendMessage({
                            action: "copy_cookies",
                            store_id: store_id,
                            result: "fail"
                        });
                        return;
                    }

                    // users will notice success since a file dialog opens
                    //
                    // use donwloads api to download a file with a save as dialog
                    // downloads.download() needs a url
                    // we can use URL.createObjectURL() to assign an url to a File or Blob
                    // -> so first create Blob from our cookie file content
                    // contains a concatenation of all of the data in the array passed into the constructor
                    let blob = new Blob(cookie_lines);
                    const temp_url = URL.createObjectURL(blob);

                    // watch for completed/faild downloads and if it matches our blob url
                    // clean up the temp url
                    browser.downloads.onChanged.addListener(function cleanUpTempBlob(downloadDelta) {
                        // arrow funcs have no self-referencing
                        // downloads.StringDelta for state (downloads.State)
                        if (downloadDelta.state.current === 'complete' ||
                            downloadDelta.state.current === 'interrupted')
                        {
                            // fail or success -> check if it's our temp blob
                            let get_dlid = browser.downloads.search(downloadDelta.id);
                            get_dlid.then((matching_dlitems) => {
                                for (dlitem of matching_dlitems) {
                                    if (dlitem.url == temp_url) {
                                        // dlitem matches our temporary blob url
                                        URL.revokeObjectURL(temp_url);
                                        browser.downloads.onChanged.removeListener(cleanUpTempBlob);
                                    }
                                }
                            });
                        }
                    });

                    browser.downloads.download({
                        saveAs: true, filename: 'cookies.txt',
                        url: temp_url
                    });
                } else {
                    navigator.clipboard.writeText(generateNetscapeCookieFile(
                        filtered_cookies_in_store, user_agent).join('')).then(function() {
                            /* clipboard successfully set */
                            console.log("Cookies copied to clip!");
                            browser.runtime.sendMessage({
                                action: "copy_cookies",
                                store_id: store_id,
                                result: "success"
                            });
                        }, function() {
                            /* clipboard write failed */
                            console.log("FAILED to copy cookies to clip!");
                            browser.runtime.sendMessage({
                                action: "copy_cookies",
                                store_id: store_id,
                                result: "fail"
                            });
                        });
                }
            } else {
                console.log("No relevant cookies found in cookie store", found_store.id);
                // don't send fail message otherwise user will be confused
                browser.runtime.sendMessage({
                    action: "copy_cookies",
                    store_id: store_id,
                    result: "no_cookies_found"
                });
            }

        });
    });
}

function handleMessage(req, sender, sendResponse) {
    if (req.action == "get_envs") {
        // use contextualIdentities (environments like work, leisure etc.)
        // they have cookieStoreId field
        let getting_ctxs = browser.contextualIdentities.query({});
        // resolve promise
        let getting_stores = browser.cookies.getAllCookieStores();

        Promise.all([getting_stores, getting_ctxs]).then((results) => {
            let stores, contexts;
            [stores, contexts] = results;

            let store_id_to_ctx = {};
            for (ctx of contexts) {
                store_id_to_ctx[ctx.cookieStoreId] = ctx;
            }
            let env_arr = [];
            for (store of stores) {
                // ctx will be undefined if store.id has no context in store_id_to_ctx
                env_arr.push({ store: store, ctx: store_id_to_ctx[store.id] });
            }
            browser.runtime.sendMessage({ action: "send_envs",
                                          envs: env_arr });
        });
    } else if (req.action == "get_cookies") {
        getCookiesByStoreId(req.store_id, req.download);
    }
}

// wait for popup to send msg
browser.runtime.onMessage.addListener(handleMessage);
