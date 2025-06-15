function openDicePage() {
	var tutorWindow = window.open('tutor.html', 'TutorPage', 
		'width=1200,height=800,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no');
	
	if (!tutorWindow || tutorWindow.closed) {
		alert('Unable to open tutor window. Please allow popups for this site.');
		return;
	}
}