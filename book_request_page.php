<?php 
include "db_connection.php";
session_start();
if(!isset($_SESSION['email'])){
	die("Please Log In");
} else {
	$email=$_SESSION['email'];
	$SQL = "SELECT * FROM users WHERE email = $email AND verified = 'YES'";
	$result = mysqli_query($dbc, $SQL);
	if (!mysqli_num_rows($result)){
		die("Error occurred");
	}
	include "navigation_login.php"; 
}
?>


<!DOCTYPE html>
<html lang="en">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">

	<style type="text/css">
		#content_signup		{ background-image:url(images/Template/container.jpg);  background-repeat: repeat-x;  text-align: center;  min-height:600px; }
		#content_signup p      {  }
		

		
		
		fieldset {background:#C1CDCD none repeat scroll 0 0;
			border:5px Groove #030f17;
		}
		legend {color: #000;
					background: #A8B3B3;
					border: 4px outset #030f17;
					padding: 1px 3px}
		.elements { padding:10px;}
		
		input[type="text"],
		textarea {
            vertical-align:middle;
			width: 240px;
			padding: 3px;
			border: none;
        }
		p { //line in header
			border-bottom:1px solid #C1CDCD;
			color:#666666;
			font-size:11px;
			margin-bottom:20px;
			padding-bottom:10px;
		}
		
		
		.myButton {
			-moz-box-shadow:inset 0px 1px 0px 0px #ffffff;
			-webkit-box-shadow:inset 0px 1px 0px 0px #ffffff;
			box-shadow:inset 0px 1px 0px 0px #ffffff;
			background:-webkit-gradient(linear, left top, left bottom, color-stop(0.05, #ffffff), color-stop(1, #f6f6f6));
			background:-moz-linear-gradient(top, #ffffff 5%, #f6f6f6 100%);
			background:-webkit-linear-gradient(top, #ffffff 5%, #f6f6f6 100%);
			background:-o-linear-gradient(top, #ffffff 5%, #f6f6f6 100%);
			background:-ms-linear-gradient(top, #ffffff 5%, #f6f6f6 100%);
			background:linear-gradient(to bottom, #ffffff 5%, #f6f6f6 100%);
			filter:progid:DXImageTransform.Microsoft.gradient(startColorstr='#ffffff', endColorstr='#f6f6f6',GradientType=0);
			background-color:#ffffff;
			-moz-border-radius:6px;
			-webkit-border-radius:6px;
			border-radius:6px;
			border:1px solid #dcdcdc;
			display:inline-block;
			cursor:pointer;
			color:#666666;
			font-family:arial;
			font-size:15px;
			font-weight:bold;
			padding:6px 24px;
			text-decoration:none;
			text-shadow:0px 1px 0px #ffffff;
		}
		.myButton:hover {
			background:-webkit-gradient(linear, left top, left bottom, color-stop(0.05, #f6f6f6), color-stop(1, #ffffff));
			background:-moz-linear-gradient(top, #f6f6f6 5%, #ffffff 100%);
			background:-webkit-linear-gradient(top, #f6f6f6 5%, #ffffff 100%);
			background:-o-linear-gradient(top, #f6f6f6 5%, #ffffff 100%);
			background:-ms-linear-gradient(top, #f6f6f6 5%, #ffffff 100%);
			background:linear-gradient(to bottom, #f6f6f6 5%, #ffffff 100%);
			filter:progid:DXImageTransform.Microsoft.gradient(startColorstr='#f6f6f6', endColorstr='#ffffff',GradientType=0);
			background-color:#f6f6f6;
		}
		.myButton:active {
			position:relative;
			top:1px;
		}



	</style>

	<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
	
	<script type="text/x-mathjax-config">
  			MathJax.Hub.Config({
    		tex2jax: { inlineMath: [['$','$'],['\\(','\\)']] }
  			});
	</script>	
	<script type="text/javascript"
  			src="//cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_HTMLorMML">
	</script>
	
	<script type='text/javascript' src='//code.jquery.com/jquery-1.6.3.js'></script>
	<script type="text/javascript" src="../javascript/menu_js_code.js"></script>
	<script type="text/javascript" src="../javascript/login_slide_toggle.js"></script>

	
	<meta name="viewport" content="width=480px">
	<link media="only screen and (min-device-width: 900px) and (max-width:9999px)" href="../style_sheet.css" title="Simplr" type="text/css" rel="stylesheet" />
	<link rel="stylesheet" type="text/css" media="only screen and (max-device-width: 900px)" href="../mobile.css"/>
	
	<title>Welcome To Probability, Statistics and Random Processes</title>
	
	<script>
		(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
		(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
		m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
		})(window,document,'script','//www.google-analytics.com/analytics.js','ga');

		ga('create', 'UA-54518759-1', 'auto');
		ga('send', 'pageview');
	</script>

</head><body>
	<div id="container">
		<div id="header">
			<?php displayMobileMenu(); ?>
		<script type="text/javascript" src="../javascript/top_page_html_code.js"></script>
			<?php displaySolution(); ?>
			<?php displayUserManager(); ?>
			<?php addLoginText(); ?>
		</div>
		<div style="clear:both;"></div>
		</div>
		</div>
	    <div id="wrapper">
			    <div id="wrapper">
		<div id="content_signup">
		<br /> <br />
<?php 
	$email=$_SESSION['email'];
	$SQL = "SELECT * FROM book_requests WHERE email = $email";
	$result = mysqli_query($dbc, $SQL);
	if (mysqli_num_rows($result)>0){
		echo "	<div class='cbox'>
					You have already requested 'Intoduction to Probability, Statistics and Random Processes' book. <br />
					Please allow us a few days to ship the book. If you have any questions, send us an email at support@probabilitycourse.com. <br /> 
				</div>";
		echo 	"</div>
					</div>
				<!--</div>-->
				<div id='footer'>
				<script type='text/javascript' src='javascript/footer_html_code.js'></script>
				</div>
				</div><!--container-->
			<html>
			</body>
			</html>";
		die();
	}
?>
	<div class="cbox">
		Please input your information in the form below to receive a free copy of the "Intoduction to Probability, Statistics and Random Processes" book.
	</div>	

<?php 
	if (isset($_SESSION['request_error'])){
		$error = $_SESSION['request_error'];
		echo '<center><p id = error>';
		echo 'Request was unsuccessful because of the following reasons: <br />';
		echo $error;
		echo '</p></center>';
		unset( $_SESSION['request_error'] );
	}
	$email=$_SESSION['email'];
	$result = mysqli_query($dbc, "SELECT * FROM users WHERE email=$email");
	$array = mysqli_fetch_array($result);
	$name = $array['firstname'] . " " . $array['lastname'];
	$coursename = $array['coursename'];
?>


<div id = "signup_form"> 
<FORM NAME ="form1" METHOD ="POST"  ACTION ="book_request_handle.php" >
	<br /> <br />
	<fieldset>
	    <legend>Book request form</legend>
		<center> Required fields *</center>
		<div class="elements">
			<label for="e-mail">Street:*</label>
			<textarea  name="address" rows="3" ></textarea>
	    </div>
        <div class="elements">
            <label for="telephone">Telephone:*</label>
            <input type="text" name="telephone" maxlength="20" required> <br><br>
        </div>

		<div class="elements">
			<label for="city">City:*</label>
			<INPUT TYPE = 'TEXT' Name ='city' maxlength="50"> <br /> <br />
	    </div>
		<div class="elements">
			<label for="state">State:*</label>
			<INPUT TYPE = 'TEXT' Name ='state'  maxlength="2"> <br /> <br />
	    </div>
		<div class="elements">
			<label for="zipcode">Zip&nbspCode:*</label>
			<INPUT TYPE = 'TEXT' Name ='zipcode' maxlength="20"> <br /> <br />
	    </div>
		<div class="elements">
			<label for="name">Name:*</label>
			<INPUT TYPE = 'TEXT' name='name' value = '<?php print $name; ?>'  maxlength="100"> <br /> <br />
	    </div>
		<div class="elements">
			<label for="name">Course&nbspname:*</label>
			<INPUT TYPE = 'TEXT' name='coursename' value = '<?php print $coursename; ?>'  maxlength="100"> <br /> <br />
	    </div>
		<div class="elements">
			<center><INPUT TYPE = "Submit" Name = "Submit1"  VALUE = "Submit" class="myButton"></center>
		</div>
	</fieldset>
	</form>
</div>

			</div><!--content-->
		</div>
	
		<!--</div>-->
		<div id="footer">
			<script type="text/javascript" src="javascript/footer_html_code.js"></script>
		</div>
	</div><!--container-->

<html>
</body>
</html>