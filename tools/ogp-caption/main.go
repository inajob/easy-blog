package main

import (
	"flag"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png"
	"os"
	"strings"

	"github.com/golang/freetype/truetype"
	"golang.org/x/image/draw"
	"golang.org/x/image/font"
	"golang.org/x/image/math/fixed"
)

const (
	targetWidth  = 1200
	targetHeight = 630
)

func main() {
	fontPath := flag.String("font", "ogp-context/MPLUS1p-Black.ttf", "font file path (TrueType)")
	flag.Parse()
	args := flag.Args()
	if len(args) < 3 {
		fmt.Fprintln(os.Stderr, "Usage: ogp-caption [-font <ttf>] <input_image> <caption> <output_image>")
		os.Exit(1)
	}
	inputFileName := args[0]
	caption := args[1]
	outputFileName := args[2]

	img, err := loadImage(inputFileName)
	if err != nil {
		fmt.Fprintln(os.Stderr, "Error loading image:", err)
		os.Exit(1)
	}

	resizedImg := resizeImageWithPadding(img, targetWidth, targetHeight)
	drawImage := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	draw.Draw(drawImage, drawImage.Bounds(), resizedImg, image.Point{}, draw.Over)

	drawWrappedText(drawImage, caption, *fontPath, 48, color.White, 6, 6)
	drawWrappedText(drawImage, caption, *fontPath, 48, color.Black, 3, 3)

	if err := saveImage(drawImage, outputFileName); err != nil {
		fmt.Fprintln(os.Stderr, "Error saving image:", err)
		os.Exit(1)
	}

	fmt.Printf("Image saved to %s with dimensions %dx%d\n", outputFileName, targetWidth, targetHeight)
}

func loadFont(fontPath string, fontSize int) font.Face {
	bfont, err := os.ReadFile(fontPath)
	if err != nil {
		panic(err)
	}
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

func drawWrappedText(img draw.Image, text string, fontPath string, fontSize int, fontColor color.Color, offsetX int, offsetY int) {
	fontFace := loadFont(fontPath, fontSize)

	point := fixed.Point26_6{
		X: fixed.I(10 + offsetX),
		Y: fixed.I(50 + offsetY),
	}

	lines := wrapText(text, targetWidth, fontSize, fontFace)
	for _, line := range lines {
		drawText(img, line, point, fontFace, fontColor)
		point.Y += fixed.I(int(float64(fontSize) * 1.5))
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

func drawText(img draw.Image, text string, point fixed.Point26_6, fontFace font.Face, fontColor color.Color) {
	drawer := &font.Drawer{
		Dst:  img,
		Src:  image.NewUniform(fontColor),
		Face: fontFace,
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
	originalWidth := img.Bounds().Dx()
	originalHeight := img.Bounds().Dy()

	resizedImg := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))

	ratio := float64(originalWidth) / float64(originalHeight)
	if float64(targetWidth)/float64(targetHeight) > ratio {
		targetWidth = int(float64(targetHeight) * ratio)
	} else {
		targetHeight = int(float64(targetWidth) / ratio)
	}

	paddingX := (resizedImg.Bounds().Dx() - targetWidth) / 2
	paddingY := (resizedImg.Bounds().Dy() - targetHeight) / 2
	draw.Draw(resizedImg, resizedImg.Bounds(), &image.Uniform{color.Black}, image.Point{paddingX, paddingY}, draw.Over)

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