var Twitter = require('twitter');
 
var client = new Twitter({
  consumer_key: '4p5WUv0uwKnjVDy6TqYWMTgkT',
  consumer_secret: 'sNTDC0BjH0fkoFFjaVnUHOYHgZkpyfcdO01kHWAhaqrhcVei7i',
  access_token_key: '737820284900782080-GLpjzYAxZjBYjOc8tEVtYyMAJV4fCuy',
  access_token_secret: 'SwLbagZKsqkJjjIQlQPu9U797OGJyPuQMOGe1aGdt1Keh'
});

client.post('statuses/update', {status: 'I Love Twitter'},  function(error, tweet, response){
  if(error) 
    return console.log("Erro");
  console.log(tweet);  // Tweet body. 
});
