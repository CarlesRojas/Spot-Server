/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

/**
 * Using pm2 to keep the app running in AWS EC2
 *      pm2 start app.js    <- Start app for the first time
 *      pm2 list            <- List current apps
 *      pm2 stop app        <- Stop an app
 *      pm2 restart app     <- Restart an app
 *      pm2 delete app      <- Delete an app
 */

var debug = false;
var redirect_url = debug ? "http://localhost:3000" : "https://carlesrojas.github.io/Spot2";

var express = require("express"); // Express web server framework
var bodyParser = require("body-parser");
var request = require("request"); // "Request" library
var cors = require("cors");
var querystring = require("querystring");
var cookieParser = require("cookie-parser");

var client_id = "81a5e48f49d341f6a74d46187616330f"; // Your client id
var client_secret = "7fe9bb8df3e14cdab6e62acb856b50cc"; // Your secret
var redirect_uri = debug ? "http://localhost:443/callback" : "https://ec2-18-191-231-228.us-east-2.compute.amazonaws.com:443/callback"; // Your redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (var i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

var stateKey = "spotify_auth_state";

var app = express();

app.use(express.static(__dirname + "/public"))
    .use(cors())
    .use(cookieParser());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/login", function (req, res) {
    console.log("Login");

    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    // your application requests authorization
    var scope =
        "user-read-recently-played user-top-read user-library-modify user-library-read playlist-read-private playlist-modify-public playlist-modify-private playlist-read-collaborative user-read-email user-read-birthdate user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing app-remote-control streaming user-follow-read user-follow-modify";
    res.redirect(
        "https://accounts.spotify.com/authorize?" +
            querystring.stringify({
                response_type: "code",
                client_id: client_id,
                scope: scope,
                redirect_uri: redirect_uri,
                state: state,
            })
    );
});

app.get("/callback", function (req, res) {
    console.log("Callback");

    // your application requests refresh and access tokens
    // after checking the state parameter

    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;

    if (state === null || state !== storedState) {
        res.redirect(
            "/#" +
                querystring.stringify({
                    error: "state_mismatch",
                })
        );
    } else {
        res.clearCookie(stateKey);
        var authOptions = {
            url: "https://accounts.spotify.com/api/token",
            form: {
                code: code,
                redirect_uri: redirect_uri,
                grant_type: "authorization_code",
            },
            headers: {
                Authorization: "Basic " + Buffer.from(client_id + ":" + client_secret).toString("base64"),
            },
            json: true,
        };

        request.post(authOptions, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                var access_token = body.access_token,
                    refresh_token = body.refresh_token;

                var options = {
                    url: "https://api.spotify.com/v1/me",
                    headers: { Authorization: "Bearer " + access_token },
                    json: true,
                };

                // we can also pass the token to the browser to make requests from there
                res.redirect(
                    redirect_url +
                        "/#" +
                        querystring.stringify({
                            access_token: access_token,
                            refresh_token: refresh_token,
                        })
                );
            } else {
                res.redirect(
                    "/#" +
                        querystring.stringify({
                            error: "invalid_token",
                        })
                );
            }
        });
    }
});

app.post("/refresh_token", function (req, res) {
    console.log("Refresh");

    // requesting access token from refresh token
    var refresh_token = req.body.refresh_token;
    var authOptions = {
        url: "https://accounts.spotify.com/api/token",
        headers: { Authorization: "Basic " + Buffer.from(client_id + ":" + client_secret).toString("base64") },
        form: {
            grant_type: "refresh_token",
            refresh_token: refresh_token,
        },
        json: true,
    };

    request.post(authOptions, function (error, response, body) {
        if (!error && response.statusCode === 200) {
            var access_token = body.access_token;
            res.send({
                access_token: access_token,
            });
        } else {
            console.log(error);
        }
    });
});

console.log("Listening on 443");
app.listen(443);
