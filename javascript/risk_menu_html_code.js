var htmlText = '<div id="menuButton" style="display:none;">Open Menu</div>';
htmlText += '<span id="hiddenMenu">';
htmlText += '<ul>';


//chapter 1
htmlText += '	<li><a href="/risk/1_preliminaries.php" class="risk_menu">1. Preliminaries</a></li>';

//chapter 2
htmlText += '	<li><a href="/risk/2_probabilistic_thinking.php" class="risk_menu">2. Probabilistic Thinking</a></li>';

//chapter 3
htmlText += '	<li><a href="/risk/3_conditioning.php" class="risk_menu">3. Probabilities, Conditioning, and Bayesian Thinking</a></li>';

//chapter 4
htmlText += '	<li><a href="/risk/4_rare_events.php" class="risk_menu">4. Rare Events</a></li>';

//chapter 5
htmlText += '	<li><a href="/risk/5_randomness_skills.php" class="risk_menu">5. Randomness and Skills</a></li>';

//chapter 6
htmlText += '	<li><a href="/risk/6_expectation.php" class="risk_menu">6. Random Variables and Expectation</a></li>';

//chapter 7
htmlText += '	<li><a href="/risk/7_decision_types.php" class="risk_menu">7. Decision Types</a></li>';

// Chapter 8
htmlText += '	<li><a href="/risk/8_low_harm_decisions.php" class="risk_menu">8. Low-Harm Decisions</a></li>';

//Chapter 9
htmlText += '	<li><a href="/risk/9_utilities.php" class="risk_menu">9. Utilities, Satisficing, and Pitfalls</a></li>';

//Chapter 10
htmlText += '	<li><a href="/risk/10_high_impact_decisions.php" class="risk_menu">10. High-Impact Decisions and Events</a></li>';

//Chapter 11
htmlText += '	<li><a href="/risk/11_positive_high_impact_events.php" class="risk_menu">11. Positive High-Impact Events</a></li>';

htmlText += '</ul>';
htmlText += '</span>';

document.write(htmlText);
