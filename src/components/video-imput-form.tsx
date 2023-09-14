import { useState, ChangeEvent, useMemo, FormEvent, useRef } from 'react';
import { getFFmpeg } from '@/lib/ffmpeg';
import { fetchFile } from '@ffmpeg/util'

import { FileVideo, Upload } from 'lucide-react';
import { Separator } from './ui/separator';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { api } from '@/lib/axios';

type Status = 'waiting' | 'converting' | 'uploading' | 'generating' | 'success'

const statusMessages = {
  converting: 'Converting...',
  generating: 'Transcribing...',
  uploading: 'Uploading...',
  success: 'Success!'
}

interface VideoInputFormProps {
  onVideoUploaded: (videoId: string) => void
}

export function VideoInputForm(props: VideoInputFormProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>('waiting')

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

    setStatus('converting')

    const audioFile = await convertVideoToAudio(videoFile)

    const data = new FormData()

    data.append('file', audioFile)

    setStatus('uploading')

    const response = await api.post('/videos', data)

    const videoId = response.data.video.id

    setStatus('generating')

    await api.post(`/videos/${videoId}/transcription`, {
      prompt,
    })

    
    props.onVideoUploaded(videoId)

    setStatus('success')
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
        disabled={status !== 'waiting'}
        className='h-20 leading-relaxed resize-none'
      />
    </div>

    <Button
      data-success={status === 'success'}
      disabled={status !== 'waiting'}
      type='submit'
      className='w-full data-[success=true]:bg-emerald-500'
    >
      {status === 'waiting' ? (
        <>
          Upload Video
          <Upload className='w-4 h-4 ml-2' />
        </>
      ) : statusMessages[status]}
    </Button>
  </form>
  )
}