<?php

include('lib/selector.inc');

// show errors
ini_set('error_reporting', E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);

$countrycodes = json_decode(file_get_contents(__DIR__.'/data/countries.json'), true); // get database with countries names
$token = ''; // App ID for Open Exchange Rates
$exchange = json_decode(file_get_contents('https://openexchangerates.org/api/latest.json?app_id='.$token), true); // get exchange rates
$data = '';

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
        $countrycode = substr($dom->select('.market')[0]['attributes']['href'], 1, 2);
        
        if (isset($dom->select('.pricing h4')[0]['text'])) {
            $price = $dom->select('.pricing h4')[0]['text']; // standart premium page
            $price = str_replace(',', '.', $price);
            $price = preg_replace('/[^,.0-9]/', '', $price);
            $price = preg_replace('/.00$/', '', $price); // beautify price
            $price = preg_replace('/^\./', '', $price); // fix for Switzerland
        }
        elseif (isset($dom->select('.specialoffer strong')[0]['text'])){ // condition for promo offers
            $price = $dom->select('.specialoffer strong')[0]['text'];
            $price = str_replace(',', '.', $price);
            $price = preg_replace('/[^,.0-9]/', '', $price);
            $price = preg_replace('/.00$/', '', $price); // beautify price
        }
        elseif (isset($dom->select('h4')[1]['text'])){ // temprorary hack for ca-fr
            $price = $dom->select('h4')[1]['text'];
            $price = str_replace(',', '.', $price);
            $price = preg_replace('/[^,.0-9]/', '', $price);
            $price = preg_replace('/.00$/', '', $price); // beautify price
        }
        elseif (isset($dom->select('.hTvmvv')[0]['text'])){
            $price = $dom->select('.hTvmvv')[0]['text'];
            $price = preg_replace('/\/.+/', '', $price);
            $price = str_replace(',', '.', $price);
            $price = preg_replace('/[^,.0-9]/', '', $price);
            $price = ltrim($price, '.');
            $price = str_replace('..', '', $price);
        }
        elseif (isset($dom->select('.specialoffer strong')[0]['text'])){ // condition for promo offers
            $price = $dom->select('.specialoffer strong')[0]['text'];
            $price = str_replace(',', '.', $price);
            $price = preg_replace('/[^,.0-9]/', '', $price);
            $price = preg_replace('/.00$/', '', $price); // beautify price
        }
        elseif ($countrycode == "mx" || $countrycode == "co" || $countrycode == "br") {
            if (isset($dom->select('.hdfOTW')[0]['text'])){ // fix for Brasil, Colombia, Mixico promo pages
                $price = $dom->select('.hdfOTW')[0]['text'];
                $price = str_replace('30 d', '', $price); // 30 dias
                $price = str_replace('s.*', '', $price); // fix point for Colombia, Mexico
                $price = preg_replace('/\/.+/', '', $price);
                $price = str_replace(',', '.', $price);
                $price = preg_replace('/[^,.0-9]/', '', $price);
                $price = str_replace('..', '', $price);
            }
        }
        elseif (isset($dom->select('.iTuPDd')[0]['text'])){ // temprorary hack for India
            $price = $dom->select('.iTuPDd')[0]['text'];
            $price = preg_replace('/\/.+/', '', $price);
            $price = str_replace(',', '.', $price);
            $price = preg_replace('/[^,.0-9]/', '', $price);
        }
        
        elseif (isset($dom->select('.promotion-header p')[0]['text'])){ // promotion price
            $price = $dom->select('.promotion-header p')[0]['text'];
            $price = preg_replace('/\/.+/', '', $price);
            $price = preg_replace('/[^0-9\.]/', '', $price);      
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

    for ($i = 0; $i < count($links); $i++) {
    
        $price = getPrice('https://www.spotify.com/'.$links[$i]["attributes"]["rel"].'/premium/');
        $rel = strtoupper(substr($links[$i]["attributes"]["rel"], 0, 2)); // substr 'ca-fr' to 'ca'

        // todo: family plan prices

        $rate = round($exchange["rates"][$countrycodes[$rel]['currency']], 2);
        $convertedPrice = $price/$rate;
        $convertedPrice = round($convertedPrice, 2);
        
        $countries[$i] = ['title' => $countrycodes[$rel]['title'], 'rel' => $rel, 'countryCode' => $countrycodes[$rel]['countryCode'], 'currency' => $countrycodes[$rel]['currency'],
        'region' => $countrycodes[$rel]['region'], 'price' => $price, 'f_price' => '', 'convertedPrice' => $convertedPrice, 'f_convertedPrice' => ''];
    };

    $countries = array_unique($countries, SORT_REGULAR);

    foreach($countries as $country) {
        //echo $country["title"]." | ".$country["rel"]." | ".$country["price"]." (".$country["convertedPrice"]."$) ".$country["currency"]." | ".$country["region"]."<br>";

        $data = $data.',{"title":"'.$country["title"].'","rel":"'.$country["rel"].'","currency":"'.$country["currency"].'","countryCode":"'.$country["countryCode"].'","region":"'.$country["region"].'","price":'.$country["price"].',"f_price":0,"convertedPrice":'.$country["convertedPrice"].'}';
    };

    $data = substr($data, 1);
    $data = "[".$data."]";

    $file = fopen(__DIR__."/data/summary.json", "w");
    fwrite($file, $data);
    fclose($file);
}
else {
	echo 'Bad link';
};

?>