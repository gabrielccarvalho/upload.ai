import { useState, ChangeEvent, useMemo, FormEvent, useRef } from 'react';
import { getFFmpeg } from '@/lib/ffmpeg';
import { fetchFile } from '@ffmpeg/util'

import { FileVideo, Upload } from 'lucide-react';
import { Separator } from './ui/separator';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';

export function VideoInputForm() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const promptInputRef = useRef<HTMLTextAreaElement>(null)

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const { files } = event.currentTarget

    if (!files) {
      return
    }

    const selectedFile = files[0]

    setVideoFile(selectedFile)
  }

  async function convertVideoToAudio(video: File) {
    console.log('Convert started.')

    const ffmpeg = await getFFmpeg()

    await ffmpeg.writeFile('input.mp4', await fetchFile(video))

    // ffmpeg.on('log', log => console.log(log)) /* DEBUG */

    ffmpeg.on('progress', progress => {
      console.log('Convert progress: ' + Math.round(progress.progress * 100))
    })

    await ffmpeg.exec([
      '-i',
      'input.mp4',
      '-map',
      '0:a',
      '-b:a',
      '20k',
      '-acodec',
      'libmp3lame',
      'output.mp3'
    ])

    const data = await ffmpeg.readFile('output.mp3')

    const audioFileBlob = new Blob([data], { type: 'audio/mp3' })
    const audioFile = new File([audioFileBlob], 'output.mp3', {
      type: 'audio/mpeg'
    })

    console.log('Convert finished.')

    return audioFile
  }

  async function handleUploadVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const prompt = promptInputRef.current?.value

    if (!videoFile) return

    const audioFile = await convertVideoToAudio(videoFile)

    console.log(audioFile, prompt)
  }

  const previewURL = useMemo(() => {
    if (!videoFile) return

    return URL.createObjectURL(videoFile)
  }, [videoFile])

  return (
    <form onSubmit={handleUploadVideo} className='space-y-6'>
    <label
      htmlFor='video'
      className='relative flex flex-col items-center justify-center gap-2 text-sm border border-dashed rounded-md cursor-pointer aspect-video text-muted-foreground hover:bg-primary/5'
    >
      {previewURL ? (
        <video src={previewURL} controls={false} className='absolute inset-0 pointer-events-none' />
      ) : (
        <>
          <FileVideo className='w-4 h-4'/>
          Select a video
        </>
      )}
    </label>

    <input type='file' id='video' accept='video/mp4' onChange={handleFileSelected} className='sr-only' />

    <Separator />

    <div className='space-y-2'>
      <Label htmlFor='transcription_prompt'>Transcription Prompt</Label>
      <Textarea
        id='transcription_prompt'
        placeholder='Add key words mentioned in the video separated by a comma ( , )'
        ref={promptInputRef}
        className='h-20 leading-relaxed resize-none'
      />
    </div>

    <Button type='submit' className='w-full'>
      Upload Video
      <Upload className='w-4 h-4 ml-2' />
    </Button>
  </form>
  )
}