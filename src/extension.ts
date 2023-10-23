// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import { eof, regexp, string } from 'parjs'
import {
  between,
  many,
  map,
  or,
  qthen,
  thenq,
  manyTill,
  then,
  flatten
} from 'parjs/combinators'
import * as pos from 'parjs/internal/parsers/position'
import * as nl from 'parjs/internal/parsers/newline'
import { pipe } from 'parjs/internal/combinators/combinator'
import { space, spaces1 } from 'parjs/internal/parsers/char-types'
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

export function activate (context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  // SASS BNF
  
  // comment
  // @media ...
  //   comment
  //   (optional).identifier
  //     comment
  //     xxx: yyy
  //     @media ...
  
  console.log('"vue-sass-peek" is now active!')
  class SassClassDefinitionProvider implements vscode.DefinitionProvider {
    constructor () {}
    provideDefinition (
      document: vscode.TextDocument,
      position: vscode.Position,
      token: vscode.CancellationToken
    ) {
      const targetText = document.getText()

      const classIdentifier = pos.position().pipe(then(regexp(/\S*/)))

      const spaces = space().pipe(many())

      const sassClassName = spaces
        .pipe(qthen(string('.')))
        .pipe(qthen(classIdentifier))
        .pipe(thenq(spaces))
        .pipe(thenq(nl.newline()))

      const styleOpenTag = regexp(/\s*<style.*>\s*/)
      const styleCloseTag = regexp(/\s*<\/style>\s*/)
      const sassClassContentLine = regexp(/.*/)
        .pipe(thenq(nl.newline()))
        .pipe(map(val => val[0]))

      const mediaQuery = spaces
        .pipe(then(string('@media')))
        .pipe(then(regexp(/.*/)))
        .pipe(then(nl.newline()))
        .pipe(map(val => val[0][0][0][0] + val[0][0][1] + val[0][1] + val[1]))

      const sassClassContent = sassClassContentLine
        .pipe(or(mediaQuery))
        .pipe(many())

      const sassComment = spaces
        .pipe(then(string('//')))
        .pipe(then(regexp(/.*/)))
        .pipe(then(nl.newline()))

      const singleSassClass = mediaQuery
        .pipe(or(sassComment))
        .pipe(or(regexp(/\s/)))
        .pipe(many())
        .pipe(qthen(sassClassName))
        .pipe(then(sassClassContent))
        .pipe(between(regexp(/(?:\r\n|\s*\/\/.*(?:\r\n))*/)))
        .pipe(then(pos.position()))

      const sassClasses = sassComment
        .pipe(or(/(\r\n|\n)/))
        .pipe(many())
        .pipe(qthen(singleSassClass.pipe(many())))
      const sassParser = sassClasses.pipe(
        map(val => {
          return val.map(
            values =>
              new SassClass(
                values[0][0][1][0],
                values[0][1],
                values[0][0][0],
                values[1]
              )
          )
        })
      )
      const otherPrevText = regexp(/(.*)/)
        .pipe(then(nl.newline()))
        .pipe(manyTill(styleOpenTag))

      const otherAfterText = regexp(/(.*)/)
        .pipe(then(nl.newline()))
        .pipe(manyTill(eof()))

      const vueSassParser = otherPrevText
        .pipe(qthen(sassParser))
        .pipe(thenq(styleCloseTag))
        .pipe(thenq(otherAfterText))

      const sassClassesParjser = vueSassParser.parse(targetText ?? '')
      console.log(sassClassesParjser)
      const definedSassClasses = sassClassesParjser.isOk
        ? sassClassesParjser.value
        : []

      // 選択されているテキストの取得
      const editor = vscode.window.activeTextEditor
      const selection = document.getWordRangeAtPosition(
        editor?.selection.active ?? new vscode.Position(0, 0)
      )
      const selectedText = document.getText(selection)
      console.log(definedSassClasses)
      return definedSassClasses
        .filter(sassClass => sassClass.className === selectedText)
        .map(
          targetSassClass =>
            new vscode.Location(
              document.uri,
              new vscode.Range(
                document.positionAt(targetSassClass.start),
                document.positionAt(targetSassClass.end)
              )
            )
        )
    }
  }

  class SassClass {
    className: string
    classContent: string
    start: number
    end: number

    constructor (
      className: string,
      classContent: string[],
      start: number,
      end: number
    ) {
      this.className = className
      this.classContent = classContent.reduce(
        (acc, content) => acc + content,
        ''
      )
      this.start = start
      this.end = end
      return this
    }
  }
  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    'vue-sass-peek.vue-sass-peek',
    () => {
      context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(
          { scheme: 'file', language: 'vue' },
          new SassClassDefinitionProvider()
        )
      )
    }
  )
  context.subscriptions.push(disposable)
}

// this method is called when your extension is deactivated
export function deactivate () {}
