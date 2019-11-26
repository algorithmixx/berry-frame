
function convertMarkDown(tagSpec) {
	// take the current HTML contents for each element of the tag spec
	// eliminate leading tabs and interpret the text as MarkDown syntax
	// replace the element content by the translated MD
	$(tagSpec).each(function(inx, elm) {
		var indent="";
		var md = elm.innerHTML;
		if (md.substr(0,2)=="\n\t") md = md.replace(/\n\t+/g,"\n");
		var parsed = new commonmark.Parser().parse(md); // parsed is a 'Node' tree
		var result = new commonmark.HtmlRenderer().render(parsed); // result is a String
		elm.innerHTML=result;
	});
}

window.addEventListener("load", function() { 
	convertMarkDown(".MD");
});
