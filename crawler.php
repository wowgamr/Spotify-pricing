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
    $response = curl_exec($handle);
    $httpCode = curl_getinfo($handle, CURLINFO_HTTP_CODE);
    curl_close($handle);
    return $response;
}

$response = getHtml('https://www.spotify.com/us/select-your-country/');

if ($response !== false)
{
    $dom = new SelectorDOM($response);
    $links = $dom->select('.select-your-country-flex li a'); // get list of countries
    //$rates = json_decode(getHtml('https://openexchangerates.org/api/latest.json?app_id='.$token), true); // get exchange rates

    for ($i = 0; $i < count($links); $i++) {

        $rel = strtoupper(substr($links[$i]["attributes"]["rel"], 0, 2)); // substr 'ca-fr' to 'ca'
        
        // todo: convert prices

        // todo: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-3
        
        $countries[$i] = ['title' => $countrycodes[$rel]['title'], 'rel' => $rel, 'code' => $countrycodes[$rel]['code'], 'currency' => $countrycodes[$rel]['currency'],
        'region' => $countrycodes[$rel]['region'], 'price' => '', 'f_price' => '', 'convertedPrice' => '', 'f_convertedPrice' => ''];
    };

    $countries = array_unique($countries, SORT_REGULAR);

    foreach($countries as $country) {
        echo $country["title"]." | ".$country["rel"]." | ".$country["currency"]." | ".$country["region"]."<br>";
        // todo: write to file
    };
}
else {
	echo 'Bad link';
};

?>