/*
 * app.js - the Zanimo editor
 */

"use strict";

var Q = require('q'),
    qstart = require('qstart'),
    Mask = require('mask'),
    $ = require('./$'),
    appcache = require('./appcache'),
    curtain = require('./curtain'),
    data = require('./data'),
    editor = require('./editor'),
    user = require('./user'),
    runner = require('./runner'),
    notification = require('./notification'),
    alert = require('./overlays/alert'),
    prompt = require('./overlays/prompt'),
    confirm = require('./overlays/confirm'),
    route = require('./route'),
    layout = require('./layout'),
    softkeyboard = require('./softkeyboard'),
    config = require('./config'),
    loaded = Q.defer(),
    app = {};

function afterOauthRedirectSuccess(u) {
    return data.syncƒ(u)
        .then(editor.refreshSelect)
        .then(editor.showLogoutBtn);
}

function afterOauthRedirectError(err) {
    return notification.fail($.formatError(err));
}

app.onActionOAuthRedirect = function (match) {
    return app
        .then(function () { return user.onOAuthRedirect(match[1]); })
        .then(data.syncƒ)
        .then(editor.refreshSelect)
        .then(editor.showLogoutBtn);
};

app.actionRunner = function (match) {
    return app.onActionRunner(match)
        .then(user.init(), function (err) {
            return notification.failƒ($.formatError(err))()
                .then(user.init());
        })
        .then(data.syncƒ)
        .then(editor.refreshSelect)
        .then(editor.showLogoutBtn);
};

app.onActionRunnerWithInit = function (match) {

    if(!window.cordova && ($.detect.ios || $.detect.android)){
        return confirm.confirm("Animation", "Run the animation on the App?").then(function (val) {
            if(!val) {
                return app.actionRunner(match);
            }
            else {
                var href = $.detect.ios ? config.IOS_CUSTOM_URL_SCHEME : config.ANDROID_INTENT;
                window.location.href = href.replace('%i', match[1]);
            }
        });
    }
    else {
        return app.actionRunner(match);
    }
};

app.onActionRunner = function (match) {
    return editor.importGistAsLocalScript(match[1])
        .then(runner.run);
};

app.onActionDefault = function () {
    return alert.show(
            'zanimo.js editor',
            $.$("#welcome-content").innerHTML
        )
        .then(user.init(afterOauthRedirectSuccess, afterOauthRedirectError))
        .then(data.syncƒ)
        .then(editor.refreshSelect)
        .then(editor.showLogoutBtn);
};

app.init = function () {

    return curtain.init()
        .then(Mask.init)
        .then(softkeyboard.init)
        .then(alert.init)
        .then(prompt.init)
        .then(confirm.init)
        .then(data.init)
        .then(notification.init)
        .then(runner.init)
        .then(editor.init)
        .then(layout)
        .then(appcache.update)
        .then(app.hideSplashscreen)
        .then(route({
            "\\?code=([a-z0-9]*)" : app.onActionOAuthRedirect,
            "\\?gist=([a-z0-9]*)" : app.onActionRunnerWithInit,
            "" : app.onActionDefault
        }));
};

app.hideSplashscreen = function (arg) {
    if (window.cordova) setTimeout(navigator.splashscreen.hide, 2000);
    return arg;
};

if(window.cordova) {
    window.handleOpenURL = function handleOpenURL(url) {
        setTimeout(function () {
            loaded.promise.then(function () {
                softkeyboard.hide();
                app.onActionRunner(url ? url.match(/\?gist=([a-z0-9]*)/) : [])
                    .done(function () { }, function (err) {
                        console.log(err);
                        notification.fail($.formatError(err));
                    });
            });
        }, 1000);
    };

    window.document.addEventListener('deviceready', function () {

        document.addEventListener('backbutton', function (evt) {
            evt.preventDefault();
        });

        app.init()
            .done(function () {
                console.log("App initialized");
                loaded.resolve(true);
            }, function () {
                loaded.resolve(true);
            });
    });

}
else {

    qstart
        .then(app.init)
        .catch(function (err) {
            if (err.toString() != '✗ user not logged...') {
                notification.fail($.formatError(err));
            }
            console.log("Error:", err, "Stack:", err.stack);
        });
}
