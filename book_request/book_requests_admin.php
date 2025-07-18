<?php
include "db_connection.php";
session_start();
if(!isset($_SESSION['email'])){
	die("Please Log In");
} else {
	$email=$_SESSION['email'];
	$SQL = "SELECT * FROM users WHERE email = $email AND administrator = 'YES'";
	$result = mysqli_query($dbc, $SQL);
	if (!mysqli_num_rows($result)){
		die("Error occurred");
	}
}
?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "//www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="//www.w3.org/1999/xhtml">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>Book Request Administration</title>

<style type="text/css">
body {
	font-family:"Lucida Grande", "Lucida Sans Unicode", Verdana, Arial, Helvetica, sans-serif;
	font-size:13px;
}

table {
	align: center;
	width: 1100px;  
}

td, tr, th {
	padding: 5px;
	text-align: center;
	font-size: 12px;  
}

th {
	background-color: #f0f0f0;
	font-weight: bold;
}

.address-col {
	max-width: 150px;
	word-wrap: break-word;
}

.telephone-col {
	min-width: 100px;
}
</style>

</head>
<body><?php

	$result = mysqli_query($dbc, "SELECT * FROM book_requests");
	$num_rows = mysqli_num_rows($result);
	echo '<a href="//www.probabilitycourse.com/">Back to Main Page</a><br /><br />';
	echo '<a href="//www.probabilitycourse.com/Login/list_users.php">Back to UserManager</a><br /><br />';
	echo "<br /> <br />";
	$idcounter = 0;
	echo '<form NAME ="form1" METHOD ="POST" ACTION ="update_book_request.php">';
	echo '<table border="1"> '."\n";
	echo "<tr>";
	echo "<th> Delete request</th>";
	echo "<th> Email </th>";
	echo "<th> Course Name </th>";
	echo "<th> Name</th>";
	echo "<th> Verified?</th>";
	echo "<th> Address</th>";
	echo "<th> Telephone</th>";  
	echo "<th> City</th>";
	echo "<th> State</th>";
	echo "<th> Zip Code</th>";
	echo "<th> Sent</th>";
	echo "<th> Mark as Sent</th>";
	echo "</tr>";
	for($i=0; $i< $num_rows; $i++){
		while(true){
			$result = mysqli_query($dbc, "SELECT * FROM book_requests WHERE id = $idcounter");
			if(mysqli_num_rows($result)>0){
				break;
			} else {
				$idcounter++;
			}
		}
		$result = mysqli_query($dbc, "SELECT * FROM book_requests WHERE id=$idcounter");
		$array = mysqli_fetch_array($result);

		echo "<tr>";
		echo '<td> <input type="checkbox" Name = "delete[]" value = "'.$idcounter.'" /></td>';
		echo "<td>". $array['email']. "</td>";
		echo "<td>". $array['coursename']. "</td>";
		echo "<td>". $array['name']. "</td>";
		echo "<td>". "YES". "</td>";
		echo '<td class="address-col">'. $array['address']. "</td>";
		echo '<td class="telephone-col">'. (isset($array['telephone']) ? $array['telephone'] : 'N/A'). "</td>";
		echo "<td>". $array['city']. "</td>";
		echo "<td>". $array['state']. "</td>";
		echo "<td>". $array['zipcode']. "</td>";			
		echo "<td>". $array['sent']. "</td>";
		if ($array['sent']=='NO'){
			echo '<td> <input type="checkbox" Name = "sent[]" value = "'.$idcounter.'" /></td>';
		} else {
			echo "<td> </td>";
		}
		echo "</tr>";
		
		$idcounter++;
	}
	echo '</table>';
	echo '<input type="submit" Name = "submit" VALUE = "Submit" />';  
	echo '</form>';
?>
</body>
</html>