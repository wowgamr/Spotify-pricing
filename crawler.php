<?php

include('lib/selector.inc');

// show errors
ini_set('error_reporting', E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);

$countrycodes = json_decode(file_get_contents('data/countries.json'), true); // get database with countries names
$token = ''; // App ID for Open Exchange Rates

function getHtml($url) {
    $handle = curl_init($url);
    curl_setopt($handle, CURLOPT_RETURNTRANSFER, TRUE);
    curl_setopt($handle, CURLOPT_FOLLOWLOCATION,1);
    $response = curl_exec($handle);
    $httpCode = curl_getinfo($handle, CURLINFO_HTTP_CODE);
    curl_close($handle);
    return $response;
}

function getPrice($url) {
    $response = getHtml($url);
    if ($response !== false)    {
        $dom = new SelectorDOM($response);
        
        if (isset($dom->select('.pricing h4')[0]['text'])) {
            $price = $dom->select('.pricing h4')[0]['text']; // standart premium page
            $price = str_replace(',', '.', $price);
            $price = preg_replace('/[^,.0-9]/', '', $price);
            $price = preg_replace('/.00$/', '', $price); // beautify price

        }
        elseif (isset($dom->select('.specialoffer strong')[0]['text'])){ // condition for promo offer (like /ca-en/)
            $price = $dom->select('.specialoffer strong')[0]['text'];
            $price = str_replace(',', '.', $price);
            $price = preg_replace('/[^,.0-9]/', '', $price);
            $price = preg_replace('/.00$/', '', $price); // beautify price
        }
        elseif (isset($dom->select('.iQlOYI')[0]['text'])){ // temprorary hack for India
            $price = $dom->select('.iQlOYI')[0]['text'];
            $price = preg_replace('/\/.+/', '', $price);
            $price = str_replace(',', '.', $price);
            $price = preg_replace('/[^,.0-9]/', '', $price);
        }
        elseif (substr($dom->select('.market')[0]['attributes']['href'], 1, 2) == "my"){ // temprorary hack for Malaysia
            $price = $dom->select('.promotion-header p')[0]['text'];
            $price = preg_replace('/\/.+/', '', $price);
            $price = preg_replace('/[^,.0-9]/', '', $price);
        }
        elseif (isset($dom->select('.promotion-header p')[0]['text'])){ // temprorary hack for Indonesia, Philippines, Thailand and Vietnam
            $price = $dom->select('.promotion-header p')[0]['text'];
            $price = preg_replace('/\/.+/', '', $price);
            $price = preg_replace('/[^0-9]/', '', $price);
        };
        
        return $price;
    }
    else {
        echo 'Bad link';
    };
    sleep(1); // timeout because of anti ddos
}

$response = getHtml('https://www.spotify.com/us/select-your-country/');

if ($response !== false)
{
    $dom = new SelectorDOM($response);
    $links = $dom->select('.select-your-country-flex li a'); // get list of countries
    //$rates = json_decode(getHtml('https://openexchangerates.org/api/latest.json?app_id='.$token), true); // get exchange rates

    for ($i = 0; $i < count($links); $i++) {
    
        $price = getPrice('https://www.spotify.com/'.$links[$i]["attributes"]["rel"].'/premium/');
        $rel = strtoupper(substr($links[$i]["attributes"]["rel"], 0, 2)); // substr 'ca-fr' to 'ca'

        // todo: family plan prices
        
        // todo: convert prices

        // todo: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3 don't remember why :D
        
        $countries[$i] = ['title' => $countrycodes[$rel]['title'], 'rel' => $rel, /* 'code' => $countrycodes[$rel]['code'], */ 'currency' => $countrycodes[$rel]['currency'],
        'region' => $countrycodes[$rel]['region'], 'price' => $price, 'f_price' => '', 'convertedPrice' => '', 'f_convertedPrice' => ''];
    };

    $countries = array_unique($countries, SORT_REGULAR);

    foreach($countries as $country) {
        echo $country["title"]." | ".$country["rel"]." | ".$country["price"]." ".$country["currency"]." | ".$country["region"]."<br>";
        // todo: write to file
    };
}
else {
	echo 'Bad link';
};

?>