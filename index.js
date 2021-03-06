/**********************************
    Fake server for heroku
**********************************/
var lastTweet = ''
var http = require('http')
var handle = function (req, res) {
    res.end(lastTweet)
}
var server = http.createServer(handle)
server.listen(process.env.PORT || 5000)

/**********************************
            Real app
**********************************/
var Twitter = require('twitter')
var cheerio = require('cheerio')
var request = require('request')
var auth = require('./auth.js')

var client = new Twitter(auth.twitter)

var tweet = function(tweetContent, fnSuccess){
    if(tweetContent.length > 140){
        tweetContent = tweetContent.substring(0, 137) + "..."
    }
    lastTweet = tweetContent
    if(process.env.DEBUG) return fnSuccess(tweetContent)
    client.post('statuses/update', {status: tweetContent},  function(error, tweet, response){
        if(error){
            return console.error(error)
        }
        fnSuccess(tweetContent)
    })
}

var fnGetTodayDate = function(){
    var d = new Date()
    var month = d.getMonth() + 1
    var day = d.getDate()

    return (d.getFullYear() + "-" + (month<10?"0"+month:month) + "-" + (day<10?"0"+day:day))
}

var options = {
    host: 'esportlivescore.com',
    path: '/l_pt_ty_notstarted_d_' + fnGetTodayDate() + '.html',
    headers: {
        'User-Agent': 'Mozilla/5.0 (X11 Linux x86_64) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.64 Safari/537.11',
        'Accept': 'text/html,application/xhtml+xml,application/xmlq=0.9,*/*q=0.8',
        'Accept-Charset': 'ISO-8859-1,utf-8q=0.7,*q=0.3',
        'Accept-Encoding': 'none',
        'Accept-Language': 'en-US,enq=0.8',
        'Connection': 'keep-alive'
    }
}

function download(opt, callback) {
    http.get(opt, function(res) {
        var data = ""
        res.on('data', function (chunk) {
            data += chunk
        })
        res.on("end", function() {
            callback(data)
        })
    }).on("error", function() {
        callback(null)
    })
}

var fnGetGameScore = function(gamesId, fnCallback){
    var eventId = ''
    gamesId.forEach(function(id) {
        eventId += '+' + id
    })

    request.post("http://esportlivescore.com/event_score_ajax", function(error, response, body){
        if(error){
            console.error("ERROR: " + error)
            fnCallback([])
        }
        if(response.statusCode !== 200){
            console.log("Status code: " + response.statusCode)
            fnCallback([])
        }

        var games = body.split('+')
        var gamesProcessed = games.map(function(game) {
            var gameData = {
                hasStarted: false
            }
            game = game.replace("#", "|")
            gameSplited = game.split("|")
            gameData.rawData = game
            gameData.hasStarted = gameSplited[3]==="started"
            gameData.startTime = JSON.parse(gameSplited[15])

            if(gameData.hasStarted){
                gameData.team1 = {}
                gameData.team2 = {}
                team1Data = gameSplited[1].split("_")
                team2Data = gameSplited[2].split("_")

                gameData.team1.gameScore = parseInt(team1Data[0])
                gameData.team2.gameScore = parseInt(team2Data[0])
                gameData.currentMap = gameData.team1.gameScore + gameData.team2.gameScore + 1
                gameData.mapNumber = team1Data.length - 1
                for (var i = 1;i < team1Data.length;i++) {
                    var mapStr = "map" + i
                    gameData.team1[mapStr] = {}
                    gameData.team2[mapStr] = {}
                    var score1 = parseInt(team1Data[i])
                    var score2 = parseInt(team2Data[i])
                    gameData.team1[mapStr].score = score1
                    gameData.team2[mapStr].score = score2
                    if(gameData.currentMap == i){
                        if(score1 === undefined || score2 === undefined){
                            gameData.hasStarted = false
                            console.error('Score undefined.\nGD: ', gameData, '\nBody: ', body);
                        }

                        gameData.team1.currentScore = score1
                        gameData.team2.currentScore = score2
                    }
                }
            }
            return gameData
        })
        fnCallback(gamesProcessed)
    }).form({
        "submit": "submit",
        "event_id": eventId
    })
}
var fnGetTeamDetails = function(htmlEvent, gameData){
    var clearName = function(thisEvent){
        var teamName = thisEvent.html()
        teamName = teamName.replace(/\<img.*\>/g, "")
                            .replace(/\(ex\-.*/g, "")
                            // Remove common names
                            .replace('Gaming', '')
                            .replace('eSports', '')
                            .replace('Team', '')
                            // Replace known teams name with their known shortcuts
                            .replace('Natus Vincere', 'Navi')
                            .replace('Ninjas in Pyjamas', 'Nip')
                            // Replace duplicated spaces
                            .replace(/\s+/g,' ')
        return teamName
    }

    var c = cheerio.load(htmlEvent.html())
    // Home team
    c("td.event-team-info a").each(function(i, elem) {
        if(i > 0){
            return
        }
        gameData.team1.name = clearName(c(this))
    })
    c("tr.event-away-team a").each(function(i, elem) {
        if(i > 0){
            return
        }
        gameData.team2.name = clearName(c(this))
    })
}

function fnGamesScore(){
    console.log("==== Trying to get");
    var gamesId = []
    download(options, function(data){
        var $ = cheerio.load(data)
        var events = $("tr.event")
        var idx = 1
        events.each(function(i, elem) {
            var thisEvent = $(this)
            if(thisEvent.html().indexOf("csgo") !== -1){
                var rawGameId = thisEvent.attr('id')
                gamesId.push({
                    id: rawGameId,
                    event: thisEvent
                })
            }
        })

        if(gamesId.length > 0) {
            var ids = gamesId.map(function (games) {return games.id})
            var gameStr = ""
            fnGetGameScore(ids, function(games){
                games.forEach(function(gameData, idx) {
                    var thisEvent = gamesId[idx].event
                    if(gameData.hasStarted){
                        fnGetTeamDetails(thisEvent, gameData)
                        var gameStrSufix = "BO" + gameData.mapNumber
                        var team1MapScore  = ""
                        var team2MapScore  = ""
                        if(gameData.mapNumber > 1){
                            team1MapScore = "(" + gameData.team1.gameScore + ")"
                            team2MapScore = "(" + gameData.team2.gameScore + ")"
                        }
                        gameStr += gameStrSufix + gameData.team1.name + team1MapScore + " " + gameData.team1.currentScore + " x " + gameData.team2.currentScore + " " + team2MapScore + gameData.team2.name + "\n"
                    }
                })
                if(gameStr !== ""){
                    console.log("==== Scores updated")
                    tweet(gameStr, function(tweetContent){
                        if(process.env.DEBUG) console.log("==== Debug mode\n", tweetContent, "==== ====")
                        else console.log("==== Tweet published\n", tweetContent, "==== ====")
                    })
                }
            })
        }
    })
    setTimeout(fnGamesScore, 60000)
    // ping the server
    http.get("http://csgogames.herokuapp.com")
    global.gc()
}

fnGamesScore()
