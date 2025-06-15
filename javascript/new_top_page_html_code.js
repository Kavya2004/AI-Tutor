function goGoogle() {
document.write('<span style="width:400px; float:right;">');
var cx = "000708056221598449280:s2l0dvomcn0";
var gcse = document.createElement("script");
gcse.type = "text/javascript";
gcse.async = true;
gcse.src = (document.location.protocol == "https:" ? "https:" : "http:") +
"//www.google.com/cse/cse.js?cx=" + cx;
var s = document.getElementsByTagName("script")[0];
s.parentNode.insertBefore(gcse, s);
document.write('<gcse:search></gcse:search></span>');
}

function writeHeader() {
var header = '<div id="header" itemscope itemtype="//schema.org/book">';
var google = '<span style="width:400px; float:right;">';


var htmlText = '<p itemprop="name">Introduction to</p>';
htmlText += '<h1 class="description"><span>P</span>robability<font>, Statistics and Random Processes</font>';
htmlText += '<img  src="images/Template/dice.png" /></h1>';
htmlText += '</div>';
htmlText += '<div id="navigation">';
htmlText += '<ul>';
htmlText += '<li><a href="//www.probabilitycourse.com/index.html">HOME</a></li>';
htmlText += '<li><a href="//www.probabilitycourse.com/videos/videos.html">VIDEOS</a></li>';
htmlText += '<li><a href="//www.probabilitycourse.com/calculator/calculator.html">CALCULATOR</a></li>';
htmlText += '<li><a href="//www.probabilitycourse.com/comments.html">COMMENTS</a></li>';

htmlText += '</ul>';
htmlText += '</div>';

document.write(header);
goGoogle();
document.write(htmlText);
}
writeHeader();