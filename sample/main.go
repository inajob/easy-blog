package main

import (
	"fmt"
	"image"
	"image/color"
	"strings"

	//"image/draw"
	"image/jpeg"
	_ "image/png"
	"os"

	"github.com/golang/freetype/truetype"
	"golang.org/x/image/draw"
	"golang.org/x/image/font"
	"golang.org/x/image/math/fixed"
)

func main() {
	if len(os.Args) < 4 {
		fmt.Println("Usage: go run main.go <input_image> <caption> <output_image>")
		return
	}
	inputImageFileName := os.Args[1]
	caption := os.Args[2]
	outputImageFileName := os.Args[3]

	targetWidth := 1200
	targetHeight := 630

	// 画像の読み込み
	img, err := loadImage(inputImageFileName)
	if err != nil {
		fmt.Println("Error loading image:", err)
		return
	}

	// 画像を指定されたサイズにリサイズ
	resizedImg := resizeImageWithPadding(img, targetWidth, targetHeight)
	drawImage := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	draw.Draw(drawImage, drawImage.Bounds(), resizedImg, image.Point{}, draw.Over)

	// テキストの設定
	fontSize := 48
	lineHeight := 1.5
	//fontColor := color.White
	text := caption

	// 折り返しを含むテキストの描画
	drawWrappedText(drawImage, text, fontSize, color.White, targetWidth, lineHeight, 0, 0)
	drawWrappedText(drawImage, text, fontSize, color.White, targetWidth, lineHeight, 2, 0)
	drawWrappedText(drawImage, text, fontSize, color.White, targetWidth, lineHeight, 4, 0)
	drawWrappedText(drawImage, text, fontSize, color.White, targetWidth, lineHeight, 0, 4)
	drawWrappedText(drawImage, text, fontSize, color.White, targetWidth, lineHeight, 0, 2)
	drawWrappedText(drawImage, text, fontSize, color.White, targetWidth, lineHeight, 4, 4)

	drawWrappedText(drawImage, text, fontSize, color.Black, targetWidth, lineHeight, 2, 2)

	// 画像を保存
	if err := saveImage(drawImage, outputImageFileName); err != nil {
		fmt.Println("Error saving image:", err)
		return
	}

	fmt.Printf("Image resized and saved to %s with dimensions %dx%d\n", outputImageFileName, targetWidth, targetHeight)
}
func loadFont(fontSize int) font.Face {
	bfont, err := os.ReadFile("mplus-1c-black.ttf")
	fnt, err := truetype.Parse(bfont)
	if err != nil {
		panic(err)
	}

	const dpi = 72
	return truetype.NewFace(fnt, &truetype.Options{
		Size:    float64(fontSize),
		DPI:     dpi,
		Hinting: font.HintingFull,
	})
}

func drawWrappedText(img draw.Image, text string, fontSize int, fontColor color.Color, maxWidth int, lineHeight float64, offsetX int, offsetY int) {
	fontFace := loadFont(fontSize)

	point := fixed.Point26_6{
		X: fixed.I(10 + offsetX), // 左端から描画開始
		Y: fixed.I(50 + offsetY), // 上端から描画開始
	}

	lines := wrapText(text, maxWidth, fontSize, fontFace)
	for _, line := range lines {
		drawText(img, line, point, fontFace, fontSize, fontColor)
		point.Y += fixed.I(int(float64(fontSize) * lineHeight))
	}
}

func wrapText(text string, maxWidth, fontSize int, fontFace font.Face) []string {
	lines := make([]string, 0)
	currentLine := ""
	currentLineWidth := 0

	for _, char := range strings.Split(text, "") {
		wordWidth := font.MeasureString(fontFace, char).Ceil()

		if currentLineWidth+wordWidth > maxWidth {
			lines = append(lines, currentLine)
			currentLine = char
			currentLineWidth = wordWidth
		} else {
			currentLine += char
			currentLineWidth += wordWidth
		}
	}

	if currentLine != "" {
		lines = append(lines, currentLine)
	}

	return lines
}

func drawText(img draw.Image, text string, point fixed.Point26_6, ffont font.Face, fontSize int, fontColor color.Color) {
	drawer := &font.Drawer{
		Dst:  img,
		Src:  image.NewUniform(fontColor),
		Face: ffont,
		Dot:  point,
	}
	drawer.DrawString(string(text))
}

func loadImage(fileName string) (image.Image, error) {
	file, err := os.Open(fileName)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return nil, err
	}

	return img, nil
}

func resizeImageWithPadding(img image.Image, targetWidth, targetHeight int) image.Image {
	// 元画像のサイズ
	originalWidth := img.Bounds().Dx()
	originalHeight := img.Bounds().Dy()

	// リサイズ後の画像を作成
	resizedImg := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))

	// アスペクト比を維持してリサイズ
	ratio := float64(originalWidth) / float64(originalHeight)
	if float64(targetWidth)/float64(targetHeight) > ratio {
		targetWidth = int(float64(targetHeight) * ratio)
	} else {
		targetHeight = int(float64(targetWidth) / ratio)
	}

	// 余白を黒で塗りつぶす
	paddingX := (resizedImg.Bounds().Dx() - targetWidth) / 2
	paddingY := (resizedImg.Bounds().Dy() - targetHeight) / 2
	draw.Draw(resizedImg, resizedImg.Bounds(), &image.Uniform{color.Black}, image.Point{paddingX, paddingY}, draw.Over)

	// リサイズ
	draw.CatmullRom.Scale(resizedImg, image.Rect(paddingX, paddingY, targetWidth+paddingX, targetHeight+paddingY), img, img.Bounds(), draw.Over, nil)

	return resizedImg
}

func saveImage(img image.Image, fileName string) error {
	file, err := os.Create(fileName)
	if err != nil {
		return err
	}
	defer file.Close()

	err = jpeg.Encode(file, img, nil)
	if err != nil {
		return err
	}

	return nil
}
