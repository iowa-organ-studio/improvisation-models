\version "2.24.4"

% =========================================================
% HISTORICAL / MODERN STAFF DEFINITIONS
%
% Write pitches TOP TO BOTTOM.
% =========================================================

#(define RH-original
   '("F5" "D5" "B4" "G4" "E4"))

#(define RH-modern
   '("F5" "D5" "B4" "G4" "E4"))


#(define LH-original
   '("B4" "G4" "E4" "C4" "A3" "F3" "D3" "B2"))

#(define LH-modern
   '("A3" "F3" "D3" "B2" "G2"))


% =========================================================
% STAGE
%
% 1 = modern
% 2 = slightly closer to original
% 3 = intermediate
% 4 = very close to original
% 5 = original
% =========================================================

#(define stage 1)


% =========================================================
% PITCH / LINE COMPARISON
% =========================================================

#(define (pitch-in-list? pitch lst)
   (if (member pitch lst)
       #t
       #f))


#(define (line-status pitch original modern)
   (cond
     ((and (pitch-in-list? pitch original)
           (pitch-in-list? pitch modern))
      '=)

     ((pitch-in-list? pitch modern)
      '+)

     ((pitch-in-list? pitch original)
      '-)

     (else
      'unknown)))


% =========================================================
% COLOR FUNCTIONS
% =========================================================

#(define (gray v)
   (rgb-color v v v))


% + lines:
%
% Stage 1 = black
% Stage 2 = almost black
% Stage 3 = light gray
% Stage 4 = medium gray
% Stage 5 = invisible

#(define plus-gray
   (cond
     ((= stage 1) 0.00)
     ((= stage 2) 0.10)
     ((= stage 3) 0.33)
     ((= stage 4) 0.67)
     ((= stage 5) 1.00)))


% - lines:
%
% Stage 1 = invisible
% Stage 2 = almost invisible
% Stage 3 = light gray
% Stage 4 = dark gray
% Stage 5 = black

#(define minus-gray
   (cond
     ((= stage 1) 1.00)
     ((= stage 2) 0.90)
     ((= stage 3) 0.67)
     ((= stage 4) 0.33)
     ((= stage 5) 0.00)))


#(define plus-color
   (gray plus-gray))

#(define minus-color
   (gray minus-gray))

#(define equal-color
   (gray 0.00))


% =========================================================
% AUTOMATIC COLOR FROM PITCH
% =========================================================

#(define (line-color pitch original modern)
   (let ((status
          (line-status pitch original modern)))

     (cond
       ((eq? status '+)
        plus-color)

       ((eq? status '-)
        minus-color)

       ((eq? status '=)
        equal-color)

       (else
        (gray 1.00)))))


% =========================================================
% RH COLORS
%
% Historical:
% B4 G4 E4 C4 A3
%
% Modern:
% F5 D5 B4 G4 E4
%
% Therefore:
% F5 +
% D5 +
% B4 =
% G4 =
% E4 =
% C4 -
% A3 -
% =========================================================

#(define RH-F5-color
   (line-color "F5" RH-original RH-modern))

#(define RH-D5-color
   (line-color "D5" RH-original RH-modern))

#(define RH-C4-color
   (line-color "C4" RH-original RH-modern))

#(define RH-A3-color
   (line-color "A3" RH-original RH-modern))


% =========================================================
% LH COLORS
%
% Historical:
% B4 G4 E4 C4 A3 F3 D3 B2
%
% Modern:
% A3 F3 D3 B2 G2
%
% Therefore:
% B4 -
% G4 -
% E4 -
% C4 -
% A3 =
% F3 =
% D3 =
% B2 =
% G2 +
% =========================================================

#(define LH-B4-color
   (line-color "B4" LH-original LH-modern))

#(define LH-G4-color
   (line-color "G4" LH-original LH-modern))

#(define LH-E4-color
   (line-color "E4" LH-original LH-modern))

#(define LH-C4-color
   (line-color "C4" LH-original LH-modern))

#(define LH-G2-color
   (line-color "G2" LH-original LH-modern))


% =========================================================
% GUIDE LINE
% =========================================================

#(define (make-guide x1 x2 y color thickness)
   (stencil-with-color
    (make-line-stencil thickness x1 y x2 y)
    color))


% =========================================================
% CLEFS
% =========================================================

#(define (stacked-treble-and-c-clef grob)
   (let* ((g-clef
           (grob-interpret-markup grob
             #{
               \markup
               \scale #'(0.50 . 0.50)
               \musicglyph "clefs.G"
             #}))
          (c-clef
           (grob-interpret-markup grob
             #{
               \markup
               \scale #'(0.45 . 0.45)
               \musicglyph "clefs.C"
             #}))
          (c-clef-down
           (ly:stencil-translate-axis c-clef -2.0 Y)))
     (ly:stencil-add g-clef c-clef-down)))


#(define (stacked-bass-and-c-clef grob)
   (let* ((bass
           (grob-interpret-markup grob
             #{
               \markup
               \scale #'(0.70 . 0.70)
               \musicglyph "clefs.F"
             #}))
          (c-clef
           (grob-interpret-markup grob
             #{
               \markup
               \scale #'(0.45 . 0.45)
               \musicglyph "clefs.C"
             #}))
          (c-clef-up
           (ly:stencil-translate-axis c-clef 2.0 Y)))
     (ly:stencil-add bass c-clef-up)))


% =========================================================
% UPPER STAFF
%
% Actual LilyPond staff lines:
% B4 G4 E4
%
% Custom lines:
% F5 D5 C4 A3
% =========================================================

#(define (upper-staff-with-colored-lines grob)
   (let* ((base
           (ly:staff-symbol::print grob))
          (x-ext
           (ly:stencil-extent base X))
          (x1
           (car x-ext))
          (x2
           (cdr x-ext))
          (thickness
           0.12)

          (upper-above1-y 1)
          (upper-above2-y 2)
          (upper-below1-y -3)
          (upper-below2-y -4))

     (ly:stencil-add
      base

      (make-guide
       x1 x2
       upper-above1-y
       RH-F5-color
       thickness)

      (make-guide
       x1 x2
       upper-above2-y
       RH-D5-color
       thickness)

      (make-guide
       x1 x2
       upper-below1-y
       RH-C4-color
       thickness)

      (make-guide
       x1 x2
       upper-below2-y
       RH-A3-color
       thickness))))


% =========================================================
% LOWER STAFF
%
% Actual LilyPond staff lines:
% A3 F3 D3 B2
%
% Custom lines:
% B4 G4 E4 C4 G2
%
% G2 is below the modern staff.
% C4, E4, G4, B4 are above it.
%
% A3 is NOT drawn again.
% =========================================================

#(define (lower-staff-with-colored-lines grob)
   (let* ((base
           (ly:staff-symbol::print grob))
          (x-ext
           (ly:stencil-extent base X))
          (x1
           (car x-ext))
          (x2
           (cdr x-ext))
          (thickness
           0.12)

          (g2-y -3)
          (c4-y 2)
          (e4-y 3)
          (g4-y 4)
          (b4-y 5))

     (ly:stencil-add
      base

      (make-guide
       x1 x2
       g2-y
       LH-G2-color
       thickness)

      (make-guide
       x1 x2
       c4-y
       LH-C4-color
       thickness)

      (make-guide
       x1 x2
       e4-y
       LH-E4-color
       thickness)

      (make-guide
       x1 x2
       g4-y
       LH-G4-color
       thickness)

      (make-guide
       x1 x2
       b4-y
       LH-B4-color
       thickness))))


% =========================================================
% PAPER
% =========================================================

\paper {
  indent = 0
  line-width = #(* 1 mm 180)
  ragged-right = ##f
  ragged-bottom = ##t
  tagline = ##f
}


% =========================================================
% SCORE
% =========================================================

\score {
  \new PianoStaff <<

    % =====================================================
    % UPPER STAFF
    % =====================================================

    \new Staff \with {
      \override StaffSymbol.line-count = #3
      \override StaffSymbol.line-positions = #'(-4 -2 0)

      \override StaffSymbol.stencil =
        #upper-staff-with-colored-lines

      \override Clef.stencil =
        #stacked-treble-and-c-clef

      \override KeySignature.flat-positions =
        #'((-7 . 6))

      \override KeyCancellation.flat-positions =
        #'((-7 . 6))

      \clef treble
    }  {

      \key f \major
      \time 4/2
      \omit Staff.TimeSignature

      
   
  %7
  <<
    {
      \voiceOne
      d''2
      c''2~
      c''2
      bes'2
    }
    \\
    {
      \voiceTwo
      bes'2
      a'2
      g'2~
      g'2
    }
    \\
    {
      \voiceTwo
      f'2~
      f'2
      ees'2~
      ees'2
    }
  >>
  %8
  <<
    {
      \voiceOne
      bes'2~ bes'4 f'4~
    }
    \\
    {
      \voiceTwo
      f'2~ f'4 s4
    }
    \\
    {
      \voiceTwo
      d'2~ d'4 s4
    }
  >>
  %8.3
  {
    \voiceOne
   f'2
  }
  %9
 
  
  
    }


    % =====================================================
    % LOWER STAFF
    % =====================================================

    \new Staff \with {
      \override StaffSymbol.line-count = #4
      \override StaffSymbol.line-positions = #'(-4 -2 0 2)

      \override StaffSymbol.stencil =
        #lower-staff-with-colored-lines

      \override Clef.stencil =
        #stacked-bass-and-c-clef

      \override KeySignature.flat-positions =
        #'((-7 . 6))

      \override KeyCancellation.flat-positions =
        #'((-7 . 6))

      \clef baritonevarF
    } {

      \key f \major
      \time 4/2
      \omit Staff.TimeSignature

 
  %7
  {
    bes,8[ c d bes,]
    f4 f,
    c16[ bes, c bes, c bes, c d]
    ees8[ c d ees]
  }
  %8
  {
    bes8[
    f8
    g8
    a8
    bes8
    c'8
    d'8
    bes8]
  }
  %8.3
   <<
    {
      \voiceOne
      c'2
      
    }
    \\
    {
      \voiceTwo
      a2
    }
    \\
    {
      \voiceTwo
      f2
    }
  >>
 
  
  
  
    }
  >>

  \layout {
    \context {
      \PianoStaff

      \override SystemStartBrace.stencil = ##f
      \override SystemStartBracket.stencil = ##f

      \override StaffGrouper.staff-staff-spacing =
        #'((basic-distance . 14)
           (minimum-distance . 12)
           (padding . 3))
    }
  }
}