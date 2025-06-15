
text/x-generic book_request_handle.php ( PHP script, ASCII text, with CRLF line terminators )
<?PHP
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
}
$errorMessage ="";
function quote_smart($value, $handle) {

   //if (get_magic_quotes_gpc()) {
       $value = stripslashes($value);
   //}

   if (!is_numeric($value)) {
       $value = "'" . mysqli_real_escape_string($handle, $value) . "'";
   }
   return $value;
}

if ($_SERVER['REQUEST_METHOD'] == 'POST'){

	//====================================================================
	//	GET THE CHOSEN E AND P, AND CHECK IT FOR DANGEROUS CHARACTERS
	//====================================================================
	$name = $_POST['name'];
	$address = $_POST['address'];
    $telephone = $_POST['telephone'];
	$city = $_POST['city'];
	$state = $_POST['state'];
	$zipcode = $_POST['zipcode'];
	$coursename = $_POST['coursename'];
	
	$name = htmlspecialchars($name);
	$address = htmlspecialchars($address);
    $telephone = htmlspecialchars($telephone);
	$city = htmlspecialchars($city);
	$state = htmlspecialchars($state);
	$zipcode = htmlspecialchars($zipcode);
	$coursename = htmlspecialchars($coursename);

	
	
	
	if (empty($name)) {
		$errorMessage = $errorMessage . "You must enter your name".  "<BR>";
	}

	if (empty($address)) {
		$errorMessage = $errorMessage . "You must enter your address" . "<BR>";
	}

    if (empty($telephone)) {  
		$errorMessage = $errorMessage . "You must enter your telephone number" . "<BR>";
	}

	if (empty($city)) {
		$errorMessage = $errorMessage . "Your must enter your city" . "<BR>";
	}
	
	if (empty($state)) {
		$errorMessage = $errorMessage . "Your must enter your state" . "<BR>";
	}	
	
	if (empty($zipcode)) {
		$errorMessage = $errorMessage . "Your must enter your zipcode" . "<BR>";
	}
	
	if (empty($coursename)) {
		$errorMessage = $errorMessage . "Your must enter the course name" . "<BR>";
	}
//test to see if $errorMessage is blank
//if it is, then we can go ahead with the rest of the code
//if it's not, we can display the error

	//====================================================================
	//	Write to the database
	//====================================================================
	if ($errorMessage == "") {

	ini_set('SMTP', "mail.probabilitycourse.com");
	define('EMAIL', 'no-reply@probabilitycourse.com');
	DEFINE('WEBSITE_URL', 'https://www.probabilitycourse.com');


		if ($db_found) {

			$name = quote_smart($name, $dbc);
			$address = quote_smart($address, $dbc);
            $telephone = quote_smart($telephone, $dbc);
			$city = quote_smart($city, $dbc);
			$state = quote_smart($state, $dbc);
			$zipcode= quote_smart($zipcode, $dbc);
			$coursename= quote_smart($coursename, $dbc);
			
			$email_address=$_SESSION['email'];
			$result = mysqli_query($dbc, "SELECT * FROM users WHERE email=$email");
			$array = mysqli_fetch_array($result);
			$id = (int)$array['id'];

			
			$SQL = "INSERT INTO book_requests (id, email, name, coursename, address, telephone, city, state, zipcode, sent) VALUES ($id, $email, $name, $coursename, $address, $telephone, $city, $state, $zipcode, 'NO')";
			
			$result = mysqli_query($dbc , $SQL);
			if (!$result) {
				echo ' Database Error Occurred ';
			} else {
			//Send the email:
			$message = "You successfully requested a book on probabilitycourse.com! You should receive another email when the book is shipped";
			mail($email_address, 'Book Request', $message, 'From:'.EMAIL);
			
			$message = "An instructor requested a copy of the book on probabilitycourse.com!:\n";
			$message = $message .'Name:'. $name ."\n";
			$message = $message .'Address:'. $address ."\n";
            $message = $message .'Telephone:'. $telephone ."\n";
			$message = $message .'City:'. $city ."\n";
			$message = $message .'State:'. $state ."\n";
			$message = $message .'Zip Code:'. $zipcode;			
			$emailto = 'h.pishronik@gmail.com';
		    mail($emailto, 'New Book Request', $message, 'From:'.EMAIL);


			mysqli_close($dbc);

			header ("Location: //www.probabilitycourse.com/Login/book_request_successful.php");
			}
		} else {
			$errorMessage = "Database Not Found";
		}


	} else {
		$_SESSION['request_error'] =  $errorMessage;
		session_write_close();
		header("Location: //www.probabilitycourse.com/Login/book_request_page.php");
	}

}


?>
