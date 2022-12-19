begin
  require 'byebug'
rescue LoadError
  # The 'byebug' gem is not necessary for running this, so made it optional
end

files = Dir.entries('../arguments').select { |f| f.index('.html') }

def convert_line(line)
  line.gsub!('{{site.baseurl}}', '/aird')
  line.gsub!(/\{% link assets\/images\/arguments\/([^\.]*)\.png %\}/, '/assets/images/arguments/\1.png')
  raise "Unprocessed Jekyll markup in line: #{line}" if line.index('{{')
  line
end

files.each do |file|
  next if file == 'index.html'
  puts "Analyzing #{file}"
  lines = []
  File.open("../arguments/#{file}", 'r') do |f|
    lines.push(f.read)
  end

  if lines.size == 1 && lines[0].index("\n")
    lines = lines[0].split("\n")
  end

  dashed_lines_found = 0
  html_start_line = -1
  title = ''
  lines.each_with_index do |line, i|
    dashed_lines_found += 1 if line == '---'
    if dashed_lines_found == 2
      html_start_line = i + 1
      break
    elsif line.start_with?('title: ')
      title = line.match(/title: "(.*)"/)[1]
    end
  end
  raise "Didn't find HTML start line" if html_start_line == -1
  puts "HTML start line: #{html_start_line}"

  File.open("../assets/html/arguments/#{file}", 'w') do |f|
    f.write "<div class=\"page-data\" data-page-title=\"#{title}\"></div>"
    lines.each_with_index do |line, i|
      next unless i >= html_start_line
      f.write "#{convert_line(line)}\n"
    end
  end
end
