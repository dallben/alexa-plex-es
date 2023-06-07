/**
 * @module states/not-authed
 */

var db = require('../db');
var plexutils = require('../plexutils');
var Q = require('q');

var SPEECH = {
    spokenURL: "Plex dot TV <break strength='medium'/> slash <break strength='medium'/> link. "
};

/**
 * Takes a PIN and generates the SSML to speak it clearly
 * @param {Object} pin - A pin object
 * @param {String} pin.code
 * @returns {string} SSML for the spoken PIN
 */
function generateSpokenPin(pin) {
    return pin.code.split('').map(function(digit) {
        return "<say-as interpret-as='spell-out'>" + digit.toLowerCase() + "</say-as>"
    }).join("<break strength='strong'/>");
}

var setup = function() {
    return Q.resolve();
};

var introIntent = function(request, response) {
    var app = request.data._plex_app;

    if (app.user.pin) {
        // If they already have a PIN, we should just push them to the next step, otherwise it can be confusing.
        setupIntent(request, response);
    } else {
        response.say("¡Bienvenido a Plex Skill para Amazon Echo! Para comenzar a usar esta Skill, deberás" +
             "Permíteme usar tu cuenta de Plex. Cuando tengas unos minutos y estés frente a una computadora con un navegador web abierto, simplemente di " +
             "'Alexa, pide a plex que comience la configuración'").send();
    }

    return false;
};

var needsNewPin = function(app, response) {
    app.plex.pinAuth.getNewPin().then(function(pin) {
        db.updatePin(app.user, pin).then(function() {
            var spokenPin = generateSpokenPin(pin);

            response.say("Muy bien, comencemos. Para vincularme a su cuenta Plex, deberá abrir su navegador web y navegar en " + SPEECH.spokenURL +
                "<break strength='x-strong' />En esa página ingrese lo siguiente PIN: " + spokenPin + ". <break strength='strong'/> Después de haber ingresado el PIN, " +
                "simplemente di <break strength='strong' /> 'Continua la configuración'.");
            response.reprompt("Una vez más, el sitio web es " + SPEECH.spokenURL + ", y tu PIN es " + spokenPin + ". Si necesitas un poco más de tiempo, está bien. Simplemente di <break strength='strong' /> 'Alexa, pide " +
                "a " + app.INVOCATION_NAME + " para continuar con la configuración' Cuando estés listo para continua");
            response.card("Vincula Alexa a tu cuenta de Plex", "Abre http://plex.tv/link e ingrese el siguiente PIN:\n\n" + pin.code);
            response.shouldEndSession(false);
            response.send();
        });
    }).catch(function(err) {
        app.skill.error(err, request, response);
    });
};

var pinExpired = function(app, response) {
    app.plex.pinAuth.getNewPin().then(function(pin) {
        db.updatePin(app.user, pin).then(function() {
            var spokenPin = generateSpokenPin(pin);

            response.say("Sorry about that. It appears that your previous PIN expired, so I've generated a new one. Navigate to Plex dot TV slash link " +
                "and enter this new PIN: " + spokenPin + ".");
            response.reprompt("Once again, the website is " + SPEECH.spokenURL + ", and your PIN is " + spokenPin + ". If you need a little more time, that's okay. Simply say <break strength='strong' /> 'Alexa, ask " +
                "" + app.INVOCATION_NAME + " to continue setup' when you are ready to continue.");
            response.card("Link Alexa to your Plex account", "Open http://plex.tv/link and enter the following PIN:\n\n" + pin.code);
            response.send();
        });
    }).catch(function(err) {
        app.skill.error(err, request, response);
    });
};

var promptPinAgain = function(app, response) {
    var pin = app.user.pin;
    var spokenPin = generateSpokenPin(pin);

    response.say("Navigate to Plex dot TV slash link and enter the following PIN: " +
        "Your PIN is " + spokenPin + ".");
    response.reprompt("Again, your PIN is " + spokenPin + ".");
    response.card("Link Alexa to your Plex account", "Open http://plex.tv/link and enter the following PIN:\n\n" + pin.code);
    response.shouldEndSession(false);
    response.send();
};

var setupIntent = function(request, response) {
    var app = request.data._plex_app;

    if (app.user.pin) {
        app.plex.pinAuth.checkPinForAuth(app.user.pin, function(err, result) {
            if(err) {
                app.skill.error(err, request, response);
                return;
            }
            if (result === 'authorized') {
                db.updateAuthToken(app.user, app.plex.pinAuth.token).then(function() {
                    app.user.setupDefaults(true).then(function() {
                        response.say("Congratulations! I am now linked to your Plex account. To save you some time, I went ahead and made some " +
                            "assumptions about which server and which player you want to use. For the server, I picked " + app.user.serverName +
                            ". And for the player, I picked " + app.user.playerName + ". If you'd like to change this, simply say 'Alexa, ask " +
                            "" + app.INVOCATION_NAME + " to change some settings.");
                        return response.send();
                    });
                }).catch(function(err) {
                    app.skill.error(err, request, response);
                });
            } else if (result === 'waiting') {
                promptPinAgain(app, response);
            } else if (result === 'invalid') {
                pinExpired(app, response);
            }
        })
    } else {
        needsNewPin(app, response);
    }

    return false;
};

module.exports = {
    intents: {
        '_default': introIntent,
        'SetupIntent': setupIntent,
        'ContinueSetupIntent': setupIntent,
        'BeginSetupIntent': setupIntent,
        'AuthorizeMeIntent': setupIntent,
        'ChangeSettingsIntent': setupIntent,

        'WhatsNewIntent': require('./common-intents').whatsNewIntent
    },
    launch: introIntent,
    setup: setup
};
