var _ = require('lodash');
var fs = require('fs');
var globArray = require('glob-array');
var chalk = require('chalk');
var logMessage = function(message) {
  if(!chalk.hasColor(message)) {
    message = chalk.cyan(message);
  }

  console.log(chalk.magenta('Doc Block Parser: ') + message);
};

module.exports = {
  create: function(options) {
    var tagValueParsers = {
      default: function(tagContent, fileContents) {
        return tagContent;
      }
    };
    _.forEach(options.tagValueParsers, function(parser, parserName) {
      tagValueParsers[parserName] = parser;
    });
    delete options.tagValueParsers;
    options = _.extend({
      multiLineTags: [
        'description',
        'example'
      ]
    }, options);

    return {
      parse: function(files) {
        if(!_.isArray(files)) {
          files = [files];
        }

        var files = globArray.sync(files);

        function resetCurrentBlock() {
          currentBlock = [];
        };

        function processBlock(blockContent, fileContents) {
          function resetCurrentTag() {
            currentTag = null;
            currentTagContent = '';
            inMultiLineTag = false;
          };

          function addTag(tag, content) {
            //remove beginning and endnew lines
            if(_.isString(content)) {
              while(content.substr(0, 1) == '\n') {
                content = substr(1);
              }

              while(content.substr(content.substr - 2, content.substr - 1) == '\n') {
                content = substr(0, content.substr - 2);
              }
            }

            if(options.multiValueTags.indexOf(tag) !== -1) {
              if(!blockJson[tag]) {
                blockJson[tag] = [];
              }

              blockJson[tag].push(content);
            } else {
              blockJson[tag] = content;
            }

            resetCurrentTag();
          };

          var currentTag;
          var currentTagContent;
          var inMultiLineTag = false;
          var blockJson = {}

          blockContent.forEach(function(line, key) {
            line = line.trim().replace(/\*\s?/, '');

            if(line.substr(0, 1) === '@') {
              //process the previous tag
              if(currentTag) {
                addTag(currentTag, currentTagContent);
              }

              var lineParts = line.substr(1).split(' ');
              currentTag = lineParts[0];
              var tagValueParser = options.tagParserMap[currentTag] || 'default';

              if(options.multiLineTags.indexOf(currentTag) !== -1) {
                inMultiLineTag = true;
              }

              //add content if it is one the same line as the tag
              if(lineParts[1]) {
                currentTagContent = tagValueParsers[tagValueParser](lineParts.slice(1).join(' '), fileContents);
              }
            } else if(inMultiLineTag === true) {
              currentTagContent += tagValueParsers.default('\n' + line, fileContents);
            } else if(line !== '' && line.substr(0, 1) !== '@') {
              currentTag = 'description';
              currentTagContent = tagValueParsers.default(line, fileContents);
              inMultiLineTag = true;
            }

            //process single line tags
            if(currentTag && inMultiLineTag === false) {
              addTag(currentTag, currentTagContent);
            }
          });

          //process the last tag if is has not been processed
          if(currentTag) {
            addTag(currentTag, currentTagContent);
          }

          comments.push(blockJson);
        };

        var comments = [];
        var currentBlock = [];

        var regex = new RegExp('[\/\\*\\*|\\*|\\*\/].*\n', 'gm');
        var lastMatch;

        files.forEach(function(file) {
          logMessage('parsing ' + file + ' for doc block comments');

          fileContents = fs.readFileSync(file, {
            encoding: 'utf8'
          });

          while(lastMatch = regex.exec(fileContents)) {
            var currentLine = lastMatch[0].trim().replace(/\n/, '');

            if(Object.keys(currentBlock).length > 0 && currentLine == '*/') {
              processBlock(currentBlock, fileContents);
              resetCurrentBlock();
              continue;
            } else if(currentLine == '/**') {
              continue;
            } else {
              currentBlock.push(currentLine);
            }
          }
        });

        return comments
      },

      generateSorter: function(sortField) {
        return function(a, b) {
          if(parseFloat(a[sortField]) < parseFloat(b[sortField])) {
             return -1;
          }

          if(parseFloat(a[sortField]) > parseFloat(b[sortField])) {
             return 1;
          }

          // a must be equal to b
          return 0;
        };
      }
    }
  }
};
