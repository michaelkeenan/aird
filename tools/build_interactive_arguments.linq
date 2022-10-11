<Query Kind="Program">
  <NuGetReference>Google.Apis.Docs.v1</NuGetReference>
  <Namespace>Google.Apis.Docs.v1</Namespace>
  <Namespace>Google.Apis.Services</Namespace>
  <Namespace>Google.Apis.Auth.OAuth2</Namespace>
  <Namespace>Google.Apis.Util.Store</Namespace>
  <Namespace>Newtonsoft.Json</Namespace>
  <Namespace>Google.Apis.Docs.v1.Data</Namespace>
</Query>

void Main()
{



	string documentsId = File.ReadLines("c:\\temp\\aird_documents_id.txt").First();
	string baseDir = Path.GetDirectoryName(Util.CurrentQueryPath) + Path.DirectorySeparatorChar + ".." + Path.DirectorySeparatorChar;
	string outputDir = baseDir + Path.DirectorySeparatorChar + "arguments" + Path.DirectorySeparatorChar;

	Directory.CreateDirectory(outputDir);

	ServiceAccountCredential credential;
	using (var stream = new FileStream("c:\\temp\\aird_service_account.json", FileMode.Open, FileAccess.Read))
	{
		// https://stackoverflow.com/questions/41267813/authenticate-to-use-google-sheets-with-service-account-instead-of-personal-accou

		credential = (ServiceAccountCredential)
			GoogleCredential.FromStream(stream).UnderlyingCredential;

		var initializer = new ServiceAccountCredential.Initializer(credential.Id)
		{
			User = "aird-build-script@aird-364611.iam.gserviceaccount.com",
			Key = credential.Key,
			Scopes = new[] { DocsService.Scope.DocumentsReadonly }
		};
		credential = new ServiceAccountCredential(initializer);
	}


	var service = new DocsService(new BaseClientService.Initializer() { HttpClientInitializer = credential, ApplicationName = "AIRD Build Script" });

	var doc = service.Documents.Get(documentsId).Execute();


	bool encounteredStartMarker = false;

	Dictionary<string, string> textblocks = new Dictionary<string, string>();
	string currentTextblock = null;



	Document currentDocument = null;
	var outputFiles = new List<Document>();

	foreach (var element in doc.Body.Content)
	{
		if (element.Paragraph == null)
			continue;
		int? headlineLevel = null;
		string style = element.Paragraph.ParagraphStyle.NamedStyleType;
		//style.Dump();
		string gdocGlyph = "";
		int? bulletLevel = null;
		string firstLinePrefix = "";
		// TODO bullet point should only generate one line, not several.
		if (encounteredStartMarker)
		{
			if (element.Paragraph.Bullet != null)
			{
				bulletLevel = element.Paragraph.Bullet.NestingLevel;
				if (bulletLevel == null)
				{
					bulletLevel = 0;
				}
				var associatedList = doc.Lists[element.Paragraph.Bullet.ListId];
				string markdownBulletSymbol;
				var nl = associatedList.ListProperties.NestingLevels[bulletLevel.Value];
				gdocGlyph = nl.GlyphSymbol;
				switch (gdocGlyph)
				{
					case "■":
					case "○":
					case "●": markdownBulletSymbol = "*"; break;
					case "-": markdownBulletSymbol = "-"; break;
					case null:
						if (nl.GlyphType == "DECIMAL")
							markdownBulletSymbol = "1.";
						else if (nl.GlyphType == "ALPHA")
							markdownBulletSymbol = "A.";
						else
							throw new NotImplementedException();
						break;
					default: throw new NotImplementedException("What is the Markdown equivalent of this google docs list glyph? " + gdocGlyph); ;
				}
				firstLinePrefix = bulletLevel == null ? "" : (new string('\t', bulletLevel.Value) + markdownBulletSymbol + " ");
			}

			if (style.StartsWith("HEADING_") && int.TryParse(style.Substring("HEADING_".Length, 1), out var x))
			{
				if (element.Paragraph.Elements.Count > 1)
					throw new InvalidOperationException("There are two different styles in a headline here. ");
				var txt = element.Paragraph.Elements[0].TextRun.Content;
				if (txt.Trim() == "")
					continue;
				if (txt.Contains("(Image generated by"))
				{
					"brk".Dump();
				}
				$"Starting new document {txt}".Dump();
				currentDocument = new Document();
				outputFiles.Add(currentDocument);
				currentDocument.InternalID = Between(txt, "[", "]").Trim();

				currentDocument.Headline = EverythingAfter(txt, "]").Trim();

				if (currentDocument.InternalID == "")
					currentDocument.InternalID = currentDocument.Headline;
				else if (currentDocument.Headline == "")
					currentDocument.Headline = currentDocument.InternalID;

				if (currentDocument.InternalID == "")
					throw new InvalidOperationException("Cannot determine internal ID for headline: " + txt);
				if (currentDocument.Headline == "")
					throw new InvalidOperationException("Cannot determine headline for " + txt);

				currentDocument.FilenameWithoutPathOrExtension = CamelToDash(currentDocument.InternalID).Replace(" ", "-");
				if (currentDocument.FilenameWithoutPathOrExtension.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
					throw new InvalidOperationException("This ID is not a valid filename: " + currentDocument.FilenameWithoutPathOrExtension);


				outputFiles.Add(currentDocument);
				headlineLevel = x;
				var breadcrumbs = "todo";
				currentDocument.Content.Add(
				 new ContentParagraph(
				$@"---
layout: argument
title: {currentDocument.Headline}
breadcrumbs: {breadcrumbs}
---\n"));


			}
		}

		// when we encounter an image, the very next element must be the image caption and start with a "(".

		bool first = true;
		int imageCaptionBracketCounter=0;
		foreach (var el in element.Paragraph.Elements)
		{
			if (el.TextRun?.TextStyle?.Strikethrough == true)
				continue;
			if (!encounteredStartMarker)
			{
				if (el.TextRun != null && el.TextRun.Content.Contains("#content_begin"))
					encounteredStartMarker = true;
				continue;
			}
			else
			{
				if (el.TextRun != null && el.TextRun.Content.Contains("#content_end"))
					goto quit;
			}

			bool currentlyBuildingAnImage = currentDocument!=null && currentDocument.Content.Count > 0 && currentDocument.Content.Last().ImageUrls.Count > 0
			&& currentDocument.Content.Last().ImageCaption ==null && imageCaptionBracketCounter=0; // if the caption is filled ( ")" encountered) in then the image block is finished.
			if (el.TextRun != null)
			{
				var txt = el.TextRun.Content.Trim();
				
				if (txt=="")
				continue;

				txt = txt.Replace("[quote]", "<blockquote>");

				txt = txt.Replace("[/quote]", "</blockquote>");

				if (currentDocument==null)
					throw new InvalidOperationException("Error: after #content_begin, there immediately must be the headline");

				if (currentlyBuildingAnImage) // currently building an image --> this text is the caption for one or several preceeding images
				{
					currentDocument.Content.Last().ImageCaption = txt;
				}
				else
					currentDocument.Content.Add(new ContentParagraph(txt) { BulletLevel = bulletLevel, BulletSymbol = gdocGlyph });
				first = false;

			}
			else if (el.InlineObjectElement != null)
			{
				var ilo = doc.InlineObjects[el.InlineObjectElement.InlineObjectId];
				var imageProps = ilo.InlineObjectProperties.EmbeddedObject.ImageProperties;
				if (!currentlyBuildingAnImage)
					currentDocument.Content.Add(new ContentParagraph("") { BulletLevel = bulletLevel, BulletSymbol = gdocGlyph });
				// we are constructing an image block consisting of several images
				currentDocument.Content.Last().ImageUrls.Add(imageProps.ContentUri);
				("Image at " + imageProps.ContentUri + ", waiting for caption or additional images...").Dump();
				continue;


			}
			else
				throw new NotImplementedException();
		}

	}
quit:
	//// resolve text blocks ( step 1)
	//foreach (var of in outputFiles)
	//{
	//	foreach (var line in of.Content.
	//}
	//// resolve text blocks ( step 2
	//if (txt.Contains("[textblock:"))
	//{
	//	string id = Between(txt, "[textblock:", "]");
	//	currentTextblock = id;
	//	textblocks[id] = EverythingAfter(currentTextblock, "[textblock:" + id + "]");
	//}
	//else if (currentTextblock != null)
	//{
	//	textblocks[currentTextblock]
	//}


	foreach (var of in outputFiles)
	{
		StringBuilder outText = new StringBuilder();

		for (int i = 0; i < of.Content.Count; i++)
		{
			var thisParagraph = of.Content[i];


			if (of.Content[i].ImageUrls.Count > 0) // write an image block
			{
				if (!of.Content[i].ImageCaption.StartsWith("("))
					ExitAndComplainAboutImageCaption(of.Content[i].ImageUrls);
				var img = new StringBuilder();
				
				if (!thisParagraph.ImageCaption.StartsWith("(") || !thisParagraph.ImageCaption.EndsWith(")"))
					ExitAndComplainAboutImageCaption(thisParagraph.ImageUrls);
				img.Append(@"<figure style='float: right'>");
				foreach (var imageUrl in thisParagraph.ImageUrls)
					img.Append("<img src='" + imageUrl + "'/>");
				img.Append("<figcaption markdown='1'>" + thisParagraph.ImageCaption + "</figcaption></figure>");

				outText.AppendLine(img.ToString());

				// to reference local, use {% link assets/images/palm.png %}
				// known deficiency: we dont generate alt texts

			}
			else // write a text block
				outText.AppendLine(thisParagraph.MarkdownText);



		}
			("Writing file " + of.FilenameWithoutPathOrExtension).Dump();
		File.WriteAllText(outputDir + of.FilenameWithoutPathOrExtension + ".md", outText.ToString());
	}
}

string GetEntireFile(List<string> lines)
{
	return string.Join(Environment.NewLine, lines);
}

string StripHtml(string caption)
{
	throw new NotImplementedException();
}

void ExitAndComplainAboutImageCaption(List<string> imageUrls)
{
	throw new InvalidOperationException($"Couldnt find caption for images {string.Join(" ", imageUrls)}. Every image must have a caption, that is written right next to it, and starts & ends with a bracket. You can also have several images next to each other and then one caption.");
}

// Define other methods and classes here


class ContentParagraph
{

	public List<string> ImageUrls = new List<string>();
	public string ImageCaption="";
	public string MarkdownText;
	public int? BulletLevel;
	public string BulletSymbol;
	public ContentParagraph(string text)
	{

		MarkdownText = text;
	}
}

class Document
{
	public string FilenameWithoutPathOrExtension, Headline, InternalID;
	public List<ContentParagraph> Content = new List<ContentParagraph>();
}


static string EverythingAfter(string s, string findCh)
{
	int index = s.IndexOf(findCh);
	if (index == -1)
		return s;

	index += findCh.Length;
	if (index >= s.Length)
		return "";
	else
		return s.Substring(index);
}

static string CamelToDash(string str)
{
	return string.Concat(str.Select((x, i) => i > 0 && char.IsUpper(x) && !char.IsUpper(str[i - 1]) ? "-" + x.ToString() : x.ToString())).ToLower();
}

static string Between(string content, string startMarker, string endMarker)
{
	var index = content.IndexOf(startMarker);
	if (index == -1)
		return "";

	int startOfTextWeWant = index + startMarker.Length;

	if (startOfTextWeWant >= content.Length)
		return "";
	int end = content.IndexOf(endMarker, startOfTextWeWant);

	if (end == -1)
		return content.Substring(startOfTextWeWant);
	else
		return content.Substring(startOfTextWeWant, end - startOfTextWeWant);
}